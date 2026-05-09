import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ActivateRequestBody {
  userId: string
  planType: 'MONTHLY' | 'YEARLY' | 'LIFETIME'
  planId?: string
}

// POST to activate user subscription
export async function POST(request: NextRequest) {
  try {
    const body: ActivateRequestBody = await request.json()
    const { userId, planType, planId } = body

    console.log('🚀 Activating user subscription:', { userId, planType, planId })

    if (!userId || !planType) {
      return NextResponse.json(
        { error: 'userId and planType are required' },
        { status: 400 }
      )
    }

    // Validate planType
    if (!['MONTHLY', 'YEARLY', 'LIFETIME'].includes(planType)) {
      return NextResponse.json(
        { error: 'Invalid planType. Must be MONTHLY, YEARLY, or LIFETIME' },
        { status: 400 }
      )
    }

    // Find user
    const user = await db.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    console.log(`✅ Found user: ${user.email}`)

    // Get or create plan based on planType
    let finalPlanId = planId

    if (!finalPlanId) {
      // Find existing plan
      let planName = ''
      let durationMonths = null
      let isLifetime = false
      let price = 0

      switch (planType) {
        case 'MONTHLY':
          planName = 'Elite Pro'
          durationMonths = 1
          price = 49000
          break
        case 'YEARLY':
          planName = 'Elite Pro'
          durationMonths = 12
          price = 588000
          break
        case 'LIFETIME':
          planName = 'Lifetime Ultra'
          isLifetime = true
          price = 100000
          break
      }

      // Find or create plan
      const existingPlan = await db.subscriptionPlan.findFirst({
        where: {
          name: planName,
          isLifetime,
          durationMonths: isLifetime ? null : durationMonths
        }
      })

      if (existingPlan) {
        finalPlanId = existingPlan.id
        console.log(`✅ Found existing plan: ${planName}`)
      } else {
        const newPlan = await db.subscriptionPlan.create({
          data: {
            name: planName,
            durationMonths,
            isLifetime,
            price,
            currency: 'IDR',
            isActive: true,
            maxSlots: isLifetime ? 30 : null
          }
        })
        finalPlanId = newPlan.id
        console.log(`✅ Created new plan: ${planName}`)
      }
    }

    // Calculate end date
    let endDate = null
    if (planType !== 'LIFETIME') {
      const startDate = new Date()
      if (planType === 'MONTHLY') {
        endDate = new Date(startDate.setMonth(startDate.getMonth() + 1))
      } else if (planType === 'YEARLY') {
        endDate = new Date(startDate.setFullYear(startDate.getFullYear() + 1))
      }
    }

    // Create subscription
    const subscription = await db.userSubscription.create({
      data: {
        userId,
        userEmail: user.email,
        userName: user.name,
        planId: finalPlanId,
        startDate: new Date(),
        endDate,
        isActive: true,
        paymentStatus: 'completed',
        amountPaid: planType === 'MONTHLY' ? 49000 : planType === 'YEARLY' ? 588000 : 100000,
        paymentMethod: 'manual',
        adminNote: `Activated by admin via Quick Activate (${planType})`
      }
    })

    console.log(`✅ Subscription created successfully: ${subscription.id}`)

    // If LIFETIME, update slot tracking
    if (planType === 'LIFETIME') {
      console.log('🔄 Updating slot tracking for LIFETIME plan...')

      const slotTracking = await db.slotTracking.findUnique({
        where: { planId: finalPlanId }
      })

      if (slotTracking) {
        const newUsedSlots = slotTracking.usedSlots + 1
        await db.slotTracking.update({
          where: { planId: finalPlanId },
          data: {
            usedSlots: newUsedSlots
          }
        })
        console.log(`✅ Slot tracking updated: ${newUsedSlots}/${slotTracking.totalSlots}`)
      } else {
        // Create slot tracking if not exists
        await db.slotTracking.create({
          data: {
            planId: finalPlanId,
            totalSlots: 30,
            usedSlots: 1
          }
        })
        console.log('✅ Slot tracking created')
      }
    }

    return NextResponse.json({
      success: true,
      subscription,
      message: 'User berhasil diaktifkan!'
    })
  } catch (error) {
    console.error('❌ Error activating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to activate subscription', details: String(error) },
      { status: 500 }
    )
  }
}
