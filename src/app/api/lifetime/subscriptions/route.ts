import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET check slot availability for Lifetime Ultra
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    const plan = await db.subscriptionPlan.findUnique({
      where: { id: planId }
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    let slotInfo = null
    if (plan.maxSlots) {
      const slotTracking = await db.slotTracking.findUnique({
        where: { planId }
      })

      if (slotTracking) {
        slotInfo = {
          totalSlots: slotTracking.totalSlots,
          usedSlots: slotTracking.usedSlots,
          availableSlots: slotTracking.totalSlots - slotTracking.usedSlots,
          isSoldOut: slotTracking.usedSlots >= slotTracking.totalSlots
        }
      }
    }

    return NextResponse.json({
      plan,
      slotInfo
    })
  } catch (error) {
    console.error('Error checking slot availability:', error)
    return NextResponse.json(
      { error: 'Failed to check slot availability' },
      { status: 500 }
    )
  }
}

// POST create a Lifetime Ultra subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { planId, userId, userEmail, userName, paymentMethod } = body

    if (!planId || !userEmail) {
      return NextResponse.json(
        { error: 'Plan ID and email are required' },
        { status: 400 }
      )
    }

    // Get plan details
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: planId }
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Check if plan has slots available
    if (plan.maxSlots) {
      const slotTracking = await db.slotTracking.findUnique({
        where: { planId }
      })

      if (!slotTracking) {
        return NextResponse.json(
          { error: 'Slot tracking not configured' },
          { status: 400 }
        )
      }

      if (slotTracking.usedSlots >= slotTracking.totalSlots) {
        return NextResponse.json(
          { error: 'SOLD OUT - No slots available' },
          { status: 400 }
        )
      }
    }

    // Check if user already has an active subscription
    const existingSubscription = await db.userSubscription.findFirst({
      where: {
        userEmail,
        isActive: true,
        planId
      }
    })

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 400 }
      )
    }

    // Create subscription (pending payment)
    const subscription = await db.userSubscription.create({
      data: {
        userId: userId || null,
        userEmail,
        userName,
        planId,
        startDate: new Date(),
        endDate: plan.isLifetime ? null : null,
        isActive: false,
        paymentStatus: 'pending',
        amountPaid: null,
        paymentMethod,
        adminNote: 'Created from public subscription form'
      }
    })

    return NextResponse.json({
      subscription,
      plan,
      message: 'Subscription created. Please complete payment to activate.'
    })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}
