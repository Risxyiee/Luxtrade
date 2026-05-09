import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all user subscriptions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const planId = searchParams.get('planId')

    const where: any = {}
    if (status) {
      where.paymentStatus = status
    }
    if (planId) {
      where.planId = planId
    }

    const subscriptions = await db.userSubscription.findMany({
      where,
      include: {
        plan: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    )
  }
}

// POST create a new subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, userEmail, userName, planId, startDate, endDate, paymentStatus, amountPaid, paymentMethod, adminNote } = body

    // Check if plan exists and has available slots
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: planId },
      include: { userSubscriptions: true }
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Check slot availability if plan has max slots
    if (plan.maxSlots) {
      const slotTracking = await db.slotTracking.findUnique({
        where: { planId }
      })

      if (!slotTracking || slotTracking.usedSlots >= slotTracking.totalSlots) {
        return NextResponse.json(
          { error: 'No available slots for this plan' },
          { status: 400 }
        )
      }
    }

    const subscription = await db.userSubscription.create({
      data: {
        userId,
        userEmail,
        userName,
        planId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        paymentStatus: paymentStatus || 'pending',
        amountPaid: amountPaid ? parseInt(amountPaid) : null,
        paymentMethod,
        adminNote,
        isActive: paymentStatus === 'completed'
      }
    })

    // Update slot tracking if plan has slots
    if (plan.maxSlots && paymentStatus === 'completed') {
      const slotTracking = await db.slotTracking.findUnique({
        where: { planId }
      })

      if (slotTracking) {
        await db.slotTracking.update({
          where: { id: slotTracking.id },
          data: { usedSlots: slotTracking.usedSlots + 1 }
        })
      }
    }

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}
