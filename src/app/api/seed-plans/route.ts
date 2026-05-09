import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check if plans already exist
    const existingPlans = await db.subscriptionPlan.findMany()

    if (existingPlans.length > 0) {
      return NextResponse.json({
        message: 'Plans already exist',
        plans: existingPlans
      })
    }

    // Create default plans
    const freePlan = await db.subscriptionPlan.create({
      data: {
        name: 'Free',
        description: 'Basic trading journal features',
        price: 0,
        currency: 'IDR',
        durationMonths: null,
        isLifetime: true,
        maxSlots: null,
        isActive: true
      }
    })

    const eliteProPlan = await db.subscriptionPlan.create({
      data: {
        name: 'Elite Pro',
        description: 'Full access to all premium features',
        price: 49000,
        currency: 'IDR',
        durationMonths: 1,
        isLifetime: false,
        maxSlots: null,
        isActive: true
      }
    })

    const lifetimeUltraPlan = await db.subscriptionPlan.create({
      data: {
        name: 'Lifetime Ultra',
        description: 'Lifetime access with exclusive VIP features',
        price: 100000,
        currency: 'IDR',
        durationMonths: null,
        isLifetime: true,
        maxSlots: 30,
        isActive: true
      }
    })

    // Create slot tracking for Lifetime Ultra
    await db.slotTracking.create({
      data: {
        planId: lifetimeUltraPlan.id,
        totalSlots: 30,
        usedSlots: 0,
        isActive: true
      }
    })

    return NextResponse.json({
      message: 'Default plans and slot tracking created successfully',
      plans: [freePlan, eliteProPlan, lifetimeUltraPlan]
    })
  } catch (error) {
    console.error('Error seeding plans:', error)
    return NextResponse.json(
      { error: 'Failed to seed plans' },
      { status: 500 }
    )
  }
}
