import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST activate a subscription
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { endDate, paymentMethod, adminNote } = body

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

    if (subscription.isActive) {
      return NextResponse.json(
        { error: 'Subscription is already active' },
        { status: 400 }
      )
    }

    // Activate subscription
    const updatedSubscription = await db.userSubscription.update({
      where: { id },
      data: {
        isActive: true,
        paymentStatus: 'completed',
        endDate: endDate ? new Date(endDate) : null,
        amountPaid: subscription.plan.price,
        paymentMethod: paymentMethod || 'manual',
        adminNote: adminNote || 'Activated by admin'
      }
    })

    // Update slot tracking if plan has max slots
    if (subscription.plan.maxSlots) {
      const slotTracking = await db.slotTracking.findUnique({
        where: { planId: subscription.planId }
      })

      if (slotTracking) {
        await db.slotTracking.update({
          where: { id: slotTracking.id },
          data: { usedSlots: slotTracking.usedSlots + 1 }
        })
      }
    }

    return NextResponse.json({
      subscription: updatedSubscription,
      message: 'Subscription activated successfully'
    })
  } catch (error) {
    console.error('Error activating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to activate subscription' },
      { status: 500 }
    )
  }
}
