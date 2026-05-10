import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { sendTelegramNotification } from '@/lib/telegram'

// Commission rate: 30% of Rp 49,000 = Rp 14,700
const COMMISSION_PER_PRO = 14700

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

    // ============================================
    // UPDATE SUPABASE PROFILES TABLE
    // ============================================
    const subscriptionDuration = planType === 'MONTHLY' ? 1 : planType === 'YEARLY' ? 12 : null
    const isLifetime = planType === 'LIFETIME'

    // Calculate subscription end date
    let subscriptionUntil: string | null = null
    if (isLifetime) {
      // Lifetime - set far future date (10 years)
      subscriptionUntil = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
    } else if (subscriptionDuration && subscriptionDuration > 0) {
      // Monthly/Yearly plan - calculate end date
      const endDateObj = new Date()
      endDateObj.setMonth(endDateObj.getMonth() + subscriptionDuration)
      subscriptionUntil = endDateObj.toISOString()
    }

    // Update Supabase profiles table
    console.log(`🔄 Updating Supabase profile for email: ${user.email}`)

    // First, get the current profile to read current values
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching profile:', fetchError)
    } else {
      console.log('✅ Current profile found:', currentProfile?.email, 'is_pro:', currentProfile?.is_pro)
    }

    const { error: profileUpdateError, data: updatedData } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'PRO',
        is_pro: true,
        subscription_until: subscriptionUntil,
        pro_status: 'active',
        pro_expiry_date: subscriptionUntil,
        has_ever_been_pro: true,
        updated_at: new Date().toISOString()
      })
      .eq('email', user.email)
      .select()

    if (profileUpdateError) {
      console.error('❌ Failed to update Supabase profile:', profileUpdateError)
      console.error('Error code:', profileUpdateError.code)
      console.error('Error message:', profileUpdateError.message)
      console.error('Error details:', profileUpdateError.details)
      // Non-blocking error - continue execution
    } else {
      console.log('✅ Supabase profile updated to PRO for:', user.email)
      console.log('✅ Updated data:', updatedData)
    }

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

    // ============================================
    // COMMISSION: Update referrer's balance
    // ============================================
    try {
      // Get user's profile to find referrer
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('referred_by_code, my_referral_code, full_name, email')
        .eq('email', user.email)
        .single()

      if (userProfile?.referred_by_code) {
        // Find referrer in Prisma
        const referrer = await db.affiliateProfile.findUnique({
          where: { myReferralCode: userProfile.referred_by_code }
        })

        if (referrer) {
          // Update referrer's balance and commission
          await db.affiliateProfile.update({
            where: { userId: referrer.userId },
            data: {
              affiliateBalance: { increment: COMMISSION_PER_PRO },
              totalCommission: { increment: COMMISSION_PER_PRO },
              totalReferrals: { increment: 1 }
            }
          })

          console.log('✅ Commission added to referrer:', referrer.email, 'Amount: Rp', COMMISSION_PER_PRO)

          // Update referrer's Supabase profile
          console.log(`🔄 Updating referrer profile: ${referrer.email}`)

          // Get current referrer profile first
          const { data: referrerProfileData } = await supabase
            .from('profiles')
            .select('affiliate_balance, referral_count')
            .eq('email', referrer.email)
            .single()

          if (referrerProfileData) {
            const newBalance = (referrerProfileData.affiliate_balance || 0) + COMMISSION_PER_PRO
            const newRefCount = (referrerProfileData.referral_count || 0) + 1

            const { error: referrerUpdateError } = await supabase
              .from('profiles')
              .update({
                affiliate_balance: newBalance,
                referral_count: newRefCount,
                updated_at: new Date().toISOString()
              })
              .eq('email', referrer.email)

            if (referrerUpdateError) {
              console.error('❌ Error updating referrer profile:', referrerUpdateError)
            } else {
              console.log('✅ Referrer profile updated. New balance:', newBalance)
            }
          } else {
            console.error('⚠️ Referrer profile not found in Supabase')
          }

          // Update referral_tracking status to 'paid'
          const { data: trackingRecord } = await supabase
            .from('referral_tracking')
            .select('id')
            .eq('referee_id', userId || user.email)
            .eq('referral_code_used', userProfile.referred_by_code)
            .single()

          if (trackingRecord) {
            await supabase
              .from('referral_tracking')
              .update({
                status: 'paid',
                commission_amount: COMMISSION_PER_PRO,
                updated_at: new Date().toISOString()
              })
              .eq('id', trackingRecord.id)
          }

          // Send Telegram notification to referrer
          try {
            const planName = planType === 'LIFETIME' ? 'Lifetime Ultra' : 'Elite Pro'
            const msg = `💰 <b>KOMISI DITERIMA!</b>\n\n🎯 Referal: ${userProfile.full_name || userProfile.email}\n💎 Upgrade ke: ${planName}\n💰 Komisi: Rp${COMMISSION_PER_PRO.toLocaleString('id-ID')}\n\nSaldo total: Rp${(referrer.affiliateBalance + COMMISSION_PER_PRO).toLocaleString('id-ID')}`
            await sendTelegramNotification(msg)
          } catch (e) {
            console.error('Failed to send Telegram notification:', e)
          }
        }
      }
    } catch (commissionError) {
      console.error('❌ Commission update error (non-blocking):', commissionError)
      // Don't fail activation if commission fails
    }

    return NextResponse.json({
      success: true,
      subscription,
      message: 'User berhasil diaktifkan!',
      supabaseProfileUpdated: !profileUpdateError
    })
  } catch (error) {
    console.error('❌ Error activating subscription:', error)

    // Detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    return NextResponse.json(
      {
        error: 'Failed to activate subscription',
        message: errorMessage,
        stack: errorStack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      },
      { status: 500 }
    )
  }
}
