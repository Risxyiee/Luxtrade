import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all subscription plans
export async function GET(request: NextRequest) {
  try {
    const plans = await db.subscriptionPlan.findMany({
      include: {
        userSubscriptions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    )
  }
}

// POST create a new subscription plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, price, currency, durationMonths, isLifetime, maxSlots, isActive } = body

    // Check if plan name already exists
    const existingPlan = await db.subscriptionPlan.findUnique({
      where: { name }
    })

    if (existingPlan) {
      return NextResponse.json(
        { error: 'Plan with this name already exists' },
        { status: 400 }
      )
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        description,
        price: parseInt(price),
        currency: currency || 'IDR',
        durationMonths: durationMonths ? parseInt(durationMonths) : null,
        isLifetime: isLifetime || false,
        maxSlots: maxSlots ? parseInt(maxSlots) : null,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    // If it's a limited slot plan, create slot tracking
    if (maxSlots) {
      await db.slotTracking.create({
        data: {
          planId: plan.id,
          totalSlots: parseInt(maxSlots),
          usedSlots: 0
        }
      })
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Error creating plan:', error)
    return NextResponse.json(
      { error: 'Failed to create plan' },
      { status: 500 }
    )
  }
}
