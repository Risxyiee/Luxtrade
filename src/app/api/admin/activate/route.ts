import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { sendTelegramNotification } from '@/lib/telegram'
import { PRICING, type PricingPlan } from '@/lib/pricing'

// Commission rates (will be used by affiliate system in Part 2)
const AFFILIATE_COMMISSION_RATE = 0.20 // 20% for recurring PRO
const LIFETIME_COMMISSION = 45000 // Rp45.000 flat for Lifetime (15% of Rp299k ≈ Rp44,850, rounded)

interface ActivateRequestBody {
  userId: string
  planType: 'PRO_30_DAYS' | 'PRO_180_DAYS' | 'PRO_LIFETIME'
}

// Map planType to pricing key and duration
function getPlanConfig(planType: string) {
  switch (planType) {
    case 'PRO_30_DAYS':
      return { price: PRICING.PRO_30_DAYS, days: 30, name: 'PRO 30 Hari', commissionRate: AFFILIATE_COMMISSION_RATE }
    case 'PRO_180_DAYS':
      return { price: PRICING.PRO_180_DAYS, days: 180, name: 'PRO 180 Hari', commissionRate: AFFILIATE_COMMISSION_RATE }
    case 'PRO_LIFETIME':
      return { price: PRICING.PRO_LIFETIME, days: 365 * 5, name: 'PRO Lifetime', commission: LIFETIME_COMMISSION }
    default:
      return null
  }
}

// POST to activate user subscription
export async function POST(request: NextRequest) {
  try {
    const body: ActivateRequestBody = await request.json()
    const { userId, planType } = body

    console.log('🚀 Activating user subscription:', { userId, planType })

    if (!userId || !planType) {
      return NextResponse.json({ error: 'userId and planType are required' }, { status: 400 })
    }

    const planConfig = getPlanConfig(planType)
    if (!planConfig) {
      return NextResponse.json(
        { error: `Invalid planType: ${planType}. Must be PRO_30_DAYS, PRO_180_DAYS, or PRO_LIFETIME` },
        { status: 400 }
      )
    }

    // Find user in Profile (PRIMARY data store for subscription)
    const profile = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'User not found in profiles' }, { status: 404 })
    }

    console.log(`✅ Found profile: ${profile.email}`)

    // Calculate subscription end date
    const isLifetime = planType === 'PRO_LIFETIME'
    let subscriptionUntil: string | null = null

    if (isLifetime) {
      subscriptionUntil = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
    } else {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + planConfig.days)
      subscriptionUntil = endDate.toISOString()
    }

    // ============================================
    // UPDATE PRISMA PROFILE
    // ============================================
    await db.profile.update({
      where: { id: userId },
      data: {
        plan: 'PRO',
        is_pro: true,
        subscription_until: subscriptionUntil ? new Date(subscriptionUntil) : null,
        hasEverBeenPro: true,
        updatedAt: new Date(),
      }
    })
    console.log(`✅ Prisma profile updated to PRO for: ${profile.email}`)

    // ============================================
    // UPDATE SUPABASE PROFILES TABLE
    // ============================================
    const { error: profileUpdateError } = await supabase
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
      .eq('id', userId)

    if (profileUpdateError) {
      console.error('❌ Failed to update Supabase profile (non-blocking):', profileUpdateError.message)
    } else {
      console.log('✅ Supabase profile updated to PRO for:', profile.email)
    }

    // ============================================
    // COMMISSION: Update referrer's balance
    // ============================================
    const commissionAmount = isLifetime
      ? planConfig.commission!
      : Math.round(planConfig.price * planConfig.commissionRate)

    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('referred_by_code, my_referral_code, full_name, email')
        .eq('id', userId)
        .single()

      if (userProfile?.referred_by_code) {
        // Find referrer profile
        const referrer = await db.profile.findFirst({
          where: { myReferralCode: userProfile.referred_by_code }
        })

        if (referrer) {
          // Update referrer's Supabase affiliate balance
          const { data: referrerData } = await supabase
            .from('profiles')
            .select('affiliate_balance, referral_count')
            .eq('id', referrer.id)
            .single()

          if (referrerData) {
            const newBalance = (referrerData.affiliate_balance || 0) + commissionAmount
            const newRefCount = (referrerData.referral_count || 0) + 1

            await supabase
              .from('profiles')
              .update({
                affiliate_balance: newBalance,
                referral_count: newRefCount,
                updated_at: new Date().toISOString()
              })
              .eq('id', referrer.id)

            console.log(`✅ Commission Rp${commissionAmount.toLocaleString('id-ID')} added to referrer: ${referrer.email}`)

            // Send Telegram notification
            try {
              const msg = `💰 <b>KOMISI DITERIMA!</b>\n\n🎯 Referal: ${userProfile.full_name || userProfile.email}\n💎 Upgrade ke: ${planConfig.name}\n💰 Komisi: Rp${commissionAmount.toLocaleString('id-ID')}\n\nSaldo total: Rp${newBalance.toLocaleString('id-ID')}`
              await sendTelegramNotification(msg)
            } catch (e) {
              console.error('Failed to send Telegram notification:', e)
            }
          }
        }
      }
    } catch (commissionError) {
      console.error('❌ Commission update error (non-blocking):', commissionError)
    }

    return NextResponse.json({
      success: true,
      message: `${profile.email} berhasil diaktifkan ke ${planConfig.name}!`,
      planType,
      subscription_until: subscriptionUntil,
      commission: commissionAmount,
    })
  } catch (error) {
    console.error('❌ Error activating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to activate subscription', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}