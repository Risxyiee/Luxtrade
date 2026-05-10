import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { sendTelegramNotification } from '@/lib/telegram'

// Commission rate: 30% of Rp 49,000 = Rp 14,700
const COMMISSION_PER_PRO = 14700

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, planType } = body

    console.log('🎯 API activate-pro called')
    console.log('   userId:', userId)
    console.log('   planType:', planType)

    if (!userId || !planType) {
      console.error('❌ Missing required fields:', { userId, planType })
      return NextResponse.json(
        { error: 'Missing userId or planType', details: 'Both userId and planType are required' },
        { status: 400 }
      )
    }

    if (planType !== 'MONTHLY' && planType !== 'LIFETIME') {
      console.error('❌ Invalid planType:', planType)
      return NextResponse.json(
        { error: 'Invalid planType', details: 'planType must be MONTHLY or LIFETIME' },
        { status: 400 }
      )
    }

    // ========================================
    // STEP 1: Find user in Prisma
    // ========================================
    console.log('📋 Step 1: Finding user in Prisma...')
    const user = await db.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error('❌ User not found in Prisma:', userId)
      return NextResponse.json(
        { error: 'User not found', details: `User with ID ${userId} does not exist in Prisma database` },
        { status: 404 }
      )
    }
    console.log('✅ User found:', user.email)

    // ========================================
    // STEP 2: Get or create plan
    // ========================================
    console.log('📋 Step 2: Getting or creating plan...')
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
      case 'LIFETIME':
        planName = 'Lifetime Ultra'
        isLifetime = true
        price = 100000
        break
    }

    const existingPlan = await db.subscriptionPlan.findFirst({
      where: {
        name: planName,
        isLifetime,
        durationMonths: isLifetime ? null : durationMonths
      }
    })

    let finalPlanId: string
    if (existingPlan) {
      finalPlanId = existingPlan.id
      console.log(`✅ Found existing plan: ${planName} (ID: ${finalPlanId})`)
    } else {
      console.log(`📝 Creating new plan: ${planName}...`)
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
      console.log(`✅ Created new plan: ${planName} (ID: ${finalPlanId})`)
    }

    // ========================================
    // STEP 3: Calculate end date
    // ========================================
    console.log('📋 Step 3: Calculating end date...')
    let endDate: Date | null = null
    if (planType !== 'LIFETIME') {
      const startDate = new Date()
      if (planType === 'MONTHLY') {
        endDate = new Date(startDate.setMonth(startDate.getMonth() + 1))
      }
    }
    console.log('   End date:', endDate?.toISOString() || 'Lifetime')

    // ========================================
    // STEP 4: Create subscription in Prisma
    // ========================================
    console.log('📋 Step 4: Creating subscription...')
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
        amountPaid: planType === 'MONTHLY' ? 49000 : 100000,
        paymentMethod: 'manual',
        adminNote: `Activated by admin via Quick Activate (${planType})`
      }
    })
    console.log(`✅ Subscription created: ${subscription.id}`)

    // ========================================
    // STEP 5: Update Supabase profiles table
    // ========================================
    console.log('📋 Step 5: Updating Supabase profiles table...')

    // Use supabaseAdmin if available (Service Role Key), otherwise use regular client
    const supabaseClient = supabaseAdmin || supabase

    if (!supabaseAdmin) {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not configured. Using regular client. Updates may fail due to RLS policies.')
    }

    // Calculate subscription end date for Supabase
    const subscriptionDuration = planType === 'MONTHLY' ? 1 : null
    const isLifetimePlan = planType === 'LIFETIME'

    let subscriptionUntil: string | null = null
    if (isLifetimePlan) {
      // Lifetime - set far future date (10 years)
      subscriptionUntil = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
    } else if (subscriptionDuration && subscriptionDuration > 0) {
      // Monthly plan - calculate end date
      const endDateObj = new Date()
      endDateObj.setMonth(endDateObj.getMonth() + subscriptionDuration)
      subscriptionUntil = endDateObj.toISOString()
    }
    console.log('   Subscription until:', subscriptionUntil)

    // Get current profile first
    const { data: currentProfile, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching profile:', fetchError)
      console.error('   Error code:', fetchError.code)
      console.error('   Error message:', fetchError.message)
    } else {
      console.log('✅ Current profile found:', currentProfile?.email, 'is_pro:', currentProfile?.is_pro)
    }

    // Update profile
    const { error: profileUpdateError, data: updatedData } = await supabaseClient
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
      console.error('   Error code:', profileUpdateError.code)
      console.error('   Error message:', profileUpdateError.message)
      console.error('   Error details:', profileUpdateError.details)
      // Non-blocking error - continue execution
    } else {
      console.log('✅ Supabase profile updated to PRO for:', user.email)
      console.log('   Updated data:', updatedData)
    }

    // ========================================
    // STEP 6: Update slot tracking for LIFETIME
    // ========================================
    if (planType === 'LIFETIME') {
      console.log('📋 Step 6: Updating slot tracking for LIFETIME...')

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

    // ========================================
    // STEP 7: COMMISSION: Update referrer's balance
    // ========================================
    console.log('📋 Step 7: Processing commission...')
    try {
      // Get user's profile to find referrer
      const { data: userProfile } = await supabaseClient
        .from('profiles')
        .select('referred_by_code, my_referral_code, full_name, email')
        .eq('email', user.email)
        .single()

      if (userProfile?.referred_by_code) {
        console.log('   User has referrer code:', userProfile.referred_by_code)

        // Find referrer in Prisma
        const referrer = await db.affiliateProfile.findUnique({
          where: { myReferralCode: userProfile.referred_by_code }
        })

        if (referrer) {
          console.log('   Referrer found:', referrer.email)

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
          const { data: referrerProfileData } = await supabaseClient
            .from('profiles')
            .select('affiliate_balance, referral_count')
            .eq('email', referrer.email)
            .single()

          if (referrerProfileData) {
            const newBalance = (referrerProfileData.affiliate_balance || 0) + COMMISSION_PER_PRO
            const newRefCount = (referrerProfileData.referral_count || 0) + 1

            const { error: referrerUpdateError } = await supabaseClient
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
          const { data: trackingRecord } = await supabaseClient
            .from('referral_tracking')
            .select('id')
            .eq('referee_id', userId || user.email)
            .eq('referral_code_used', userProfile.referred_by_code)
            .single()

          if (trackingRecord) {
            await supabaseClient
              .from('referral_tracking')
              .update({
                status: 'paid',
                commission_amount: COMMISSION_PER_PRO,
                updated_at: new Date().toISOString()
              })
              .eq('id', trackingRecord.id)
            console.log('✅ Referral tracking updated')
          }

          // Send Telegram notification to referrer
          try {
            const planName2 = planType === 'LIFETIME' ? 'Lifetime Ultra' : 'Elite Pro'
            const msg = `💰 <b>KOMISI DITERIMA!</b>\n\n🎯 Referal: ${userProfile.full_name || userProfile.email}\n💎 Upgrade ke: ${planName2}\n💰 Komisi: Rp${COMMISSION_PER_PRO.toLocaleString('id-ID')}\n\nSaldo total: Rp${(referrer.affiliateBalance + COMMISSION_PER_PRO).toLocaleString('id-ID')}`
            await sendTelegramNotification(msg)
          } catch (e) {
            console.error('Failed to send Telegram notification:', e)
          }
        } else {
          console.log('   Referrer not found in Prisma for code:', userProfile.referred_by_code)
        }
      } else {
        console.log('   User has no referrer code')
      }
    } catch (commissionError) {
      console.error('❌ Commission update error (non-blocking):', commissionError)
      // Don't fail activation if commission fails
    }

    console.log('✅ PRO Activation completed successfully!')
    return NextResponse.json({
      success: true,
      message: `User successfully activated with ${planType} plan`,
      data: {
        userId,
        userEmail: user.email,
        planId: finalPlanId,
        planName,
        subscriptionId: subscription.id,
        subscriptionUntil
      }
    })
  } catch (error) {
    console.error('❌ ERROR DETAIL:', error)
    console.error('   Error type:', error?.constructor?.name)
    console.error('   Error message:', error instanceof Error ? error.message : String(error))
    console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json(
      {
        error: 'Failed to activate Pro subscription',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
