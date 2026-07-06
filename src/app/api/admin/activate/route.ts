import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { sendAdminNotification } from '@/lib/admin-notify'
import { PRICING } from '@/lib/pricing'
import { createClient } from '@supabase/supabase-js'

// Commission rates — dynamic from PRICING
const AFFILIATE_COMMISSION_RATE = 0.20 // 20% for recurring PRO
const AFFILIATE_LIFETIME_RATE = 0.15  // 15% one-time for Lifetime

/** Get Supabase admin client (service role, bypasses RLS) */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

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
      return { price: PRICING.PRO_LIFETIME, days: 365 * 5, name: 'PRO Lifetime', commissionRate: AFFILIATE_LIFETIME_RATE }
    default:
      return null
  }
}

// POST to activate user subscription
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { error: authError, user: adminUser } = await requireAdmin(request)
    if (authError) return authError

    const body: ActivateRequestBody = await request.json()
    const { userId, planType } = body

    console.log('🚀 Admin activating subscription:', { adminUser: adminUser?.email, userId, planType })

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
    // UPDATE SUPABASE PROFILES TABLE (PRIMARY — always works)
    // ============================================
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured — missing Supabase service role key' }, { status: 500 })
    }

    // Fetch user info first for the response
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (!existingProfile) {
      return NextResponse.json({ error: 'User not found in profiles' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_status: 'PRO',
        is_pro: true,
        plan: 'PRO',
        subscription_until: subscriptionUntil,
        pro_status: 'active',
        pro_expiry_date: subscriptionUntil,
        has_ever_been_pro: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to update Supabase profile:', updateError.message)
      return NextResponse.json({ error: 'Failed to update user profile', details: updateError.message }, { status: 500 })
    }

    console.log(`✅ Supabase profile updated to PRO for: ${existingProfile.email}`)

    // ============================================
    // UPDATE PRISMA PROFILE (if DB available, non-blocking)
    // ============================================
    if (isDatabaseAvailable()) {
      try {
        // Try update first
        try {
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
        } catch {
          // Profile might not exist in Prisma yet — create it
          try {
            await db.profile.create({
              data: {
                id: userId,
                email: existingProfile.email,
                full_name: existingProfile.full_name,
                plan: 'PRO',
                is_pro: true,
                subscription_until: subscriptionUntil ? new Date(subscriptionUntil) : null,
                hasEverBeenPro: true,
              }
            })
          } catch (createErr) {
            console.error('⚠️ Prisma profile sync failed (non-blocking):', createErr)
          }
        }
      } catch (prismaErr) {
        console.error('⚠️ Prisma profile sync error (non-blocking):', prismaErr)
      }
    }

    // ============================================
    // COMMISSION: Update referrer's balance
    // ============================================
    const commissionAmount = Math.round(planConfig.price * planConfig.commissionRate)

    try {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('referred_by_code, my_referral_code, full_name, email')
        .eq('id', userId)
        .single()

      if (userProfile?.referred_by_code) {
        // Find referrer profile in Supabase
        const { data: referrerData } = await supabaseAdmin
          .from('profiles')
          .select('id, affiliate_balance, referral_count, email')
          .eq('my_referral_code', userProfile.referred_by_code)
          .single()

        if (referrerData) {
          const newBalance = (referrerData.affiliate_balance || 0) + commissionAmount
          const newRefCount = (referrerData.referral_count || 0) + 1

          await supabaseAdmin
            .from('profiles')
            .update({
              affiliate_balance: newBalance,
              referral_count: newRefCount,
              updated_at: new Date().toISOString()
            })
            .eq('id', referrerData.id)

          console.log(`✅ Commission Rp${commissionAmount.toLocaleString('id-ID')} added to referrer: ${referrerData.email}`)

          // Send admin notification
          try {
            const msg = `💰 <b>KOMISI DITERIMA!</b>\n\n🎯 Referal: ${userProfile.full_name || userProfile.email}\n💎 Upgrade ke: ${planConfig.name}\n💰 Komisi: Rp${commissionAmount.toLocaleString('id-ID')}\n\nSaldo total: Rp${newBalance.toLocaleString('id-ID')}`
            await sendAdminNotification(msg)
          } catch (e) {
            console.error('Failed to send admin notification:', e)
          }
        }
      }
    } catch (commissionError) {
      console.error('❌ Commission update error (non-blocking):', commissionError)
    }

    return NextResponse.json({
      success: true,
      message: `${existingProfile.email} berhasil diaktifkan ke ${planConfig.name}!`,
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