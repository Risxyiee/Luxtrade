import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT update a subscription
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { id } = params
    const { userEmail, userName, planId, startDate, endDate, isActive, paymentStatus, amountPaid, paymentMethod, adminNote } = body

    // Get current subscription to check if plan changed
    const currentSubscription = await db.userSubscription.findUnique({
      where: { id },
      include: { plan: true }
    })

    if (!currentSubscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Calculate duration from endDate if provided
    let durationMonths = null
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      durationMonths = months
    }

    const subscription = await db.userSubscription.update({
      where: { id },
      data: {
        userEmail,
        userName,
        planId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : undefined,
        paymentStatus: paymentStatus !== undefined ? paymentStatus : undefined,
        amountPaid: amountPaid ? parseInt(amountPaid) : undefined,
        paymentMethod,
        adminNote
      }
    })

    // If payment status changed to completed and was previously not completed, update slot tracking
    if (
      paymentStatus === 'completed' &&
      currentSubscription.paymentStatus !== 'completed' &&
      currentSubscription.plan.maxSlots
    ) {
      const slotTracking = await db.slotTracking.findUnique({
        where: { planId: currentSubscription.planId }
      })

      if (slotTracking) {
        await db.slotTracking.update({
          where: { id: slotTracking.id },
          data: { usedSlots: slotTracking.usedSlots + 1 }
        })
      }
    }

    // If plan changed, handle slot tracking
    if (planId && planId !== currentSubscription.planId) {
      const oldSlotTracking = await db.slotTracking.findUnique({
        where: { planId: currentSubscription.planId }
      })

      const newPlan = await db.subscriptionPlan.findUnique({
        where: { id: planId }
      })

      if (newPlan && newPlan.maxSlots && paymentStatus === 'completed') {
        const newSlotTracking = await db.slotTracking.findUnique({
          where: { planId }
        })

        if (newSlotTracking) {
          await db.slotTracking.update({
            where: { id: newSlotTracking.id },
            data: { usedSlots: newSlotTracking.usedSlots + 1 }
          })
        }
      }
    }

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    )
  }
}

// DELETE a subscription
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    await db.userSubscription.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    )
  }
}
