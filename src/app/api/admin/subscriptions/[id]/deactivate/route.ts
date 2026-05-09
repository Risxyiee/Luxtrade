import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST deactivate a subscription
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { reason } = body

    // Get current subscription
    const subscription = await db.userSubscription.findUnique({
      where: { id },
      include: { plan: true }
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    if (!subscription.isActive) {
      return NextResponse.json(
        { error: 'Subscription is already inactive' },
        { status: 400 }
      )
    }

    // Deactivate subscription
    const updatedSubscription = await db.userSubscription.update({
      where: { id },
      data: {
        isActive: false,
        adminNote: reason || `Deactivated on ${new Date().toISOString()}`
      }
    })

    // Optionally: Update slot tracking to free up a slot
    if (subscription.plan.maxSlots && subscription.paymentStatus === 'completed') {
      const slotTracking = await db.slotTracking.findUnique({
        where: { planId: subscription.planId }
      })

      if (slotTracking && slotTracking.usedSlots > 0) {
        await db.slotTracking.update({
          where: { id: slotTracking.id },
          data: { usedSlots: slotTracking.usedSlots - 1 }
        })
      }
    }

    return NextResponse.json({
      subscription: updatedSubscription,
      message: 'Subscription deactivated successfully'
    })
  } catch (error) {
    console.error('Error deactivating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate subscription' },
      { status: 500 }
    )
  }
}
