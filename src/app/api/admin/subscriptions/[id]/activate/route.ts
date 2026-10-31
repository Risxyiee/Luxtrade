import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAdminAuth } from '@/lib/supabase-admin-alt'
import { requireAdmin } from '@/lib/admin-auth'
import { PRICING } from '@/lib/pricing'
import { applyActivationCommission } from '@/lib/affiliate-commission'

// Commission rates — calculated dynamically from PRICING
const AFFILIATE_COMMISSION_RATE = 0.20 // 20% for recurring PRO
const AFFILIATE_LIFETIME_RATE = 0.15  // 15% one-time for Lifetime

/**
 * Resolve a userId to a user profile via Supabase.
 * Tries the profiles table first, then falls back to Supabase Auth.
 */
async function resolveUser(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, userId: string) {
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, full_name, my_referral_code, referred_by_code')
    .eq('id', userId)
    .single()

  if (profile) {
    return {
      id: profile.id,
      email: profile.email || '',
      fullName: profile.full_name || '',
      myReferralCode: profile.my_referral_code || null,
      referredByCode: profile.referred_by_code || null,
    }
  }

  // Fallback: Auth API
  try {
    const authAdmin = getAdminAuth()
    if (!authAdmin) return null
    const { data: { user: authUser }, error: authErr } = await authAdmin.getUserById(userId)
    if (authErr || !authUser) return null

    // Auto-create profile
    await admin.from('profiles').upsert({
      id: userId,
      email: authUser.email || '',
      full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
      plan: 'FREE',
      is_pro: false,
      subscription_status: 'FREE',
      created_at: authUser.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    return {
      id: userId,
      email: authUser.email || '',
      fullName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
      myReferralCode: null,
      referredByCode: null,
    }
  } catch (err) {
    console.warn('[admin/subscription/activate] getUserInfo lookup failed:', err)
    return null
  }
}

// POST activate a subscription by subscription id (from user_subscriptions table)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

    const params = await context.params
    const subscriptionId = params.id
    const body = await request.json()
    const { planType: overridePlanType } = body

    console.log('🚀 Admin activating subscription via [id]/activate:', { subscriptionId })

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured — missing Supabase service role key' },
        { status: 500 }
      )
    }

    // ============================================
    // STEP 1: Look up the subscription from user_subscriptions to get userId & plan
    // ============================================
    let userId: string | null = null
    let plan: string | null = null

    try {
      const { data: subscription, error: subErr } = await admin
        .from('user_subscriptions')
        .select('user_id, plan')
        .eq('id', subscriptionId)
        .single()

      if (subErr || !subscription) {
        // If not found, the caller must provide userId and planType in body
        if (!body.userId || !body.planType) {
          return NextResponse.json(
            { error: 'Subscription not found in database. Provide userId and planType in request body.' },
            { status: 400 }
          )
        }
        userId = body.userId
        plan = body.planType
      } else {
        userId = subscription.user_id
        plan = overridePlanType || subscription.plan
      }
    } catch (subLookupErr) {
      console.warn('[admin/subscription/activate] subscription lookup failed:', subLookupErr)
      if (!body.userId || !body.planType) {
        return NextResponse.json(
          { error: 'Subscription not found in database. Provide userId and planType in request body.' },
          { status: 400 }
        )
      }
      userId = body.userId
      plan = body.planType
    }

    // ============================================
    // STEP 2: Resolve plan config from PRICING
    // ============================================
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    if (!plan) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 })
    }

    const planConfig = resolvePlanConfig(plan)
    if (!planConfig) {
      return NextResponse.json(
        { error: `Cannot resolve plan: ${plan}. Supported: PRO_30_DAYS, PRO_180_DAYS, PRO_ANNUAL, PRO_LIFETIME, LIFETIME_ULTRA` },
        { status: 400 }
      )
    }

    // ============================================
    // STEP 3: Resolve user profile
    // ============================================
    const userProfile = await resolveUser(admin, userId)
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found in profiles or Auth' },
        { status: 404 }
      )
    }

    console.log(`✅ Resolved user: ${userProfile.id}, Plan: ${planConfig.name}`) // PII redacted

    // ============================================
    // STEP 4: Calculate subscription end date
    // ============================================
    let subscriptionUntil: string | null = null
    if (planConfig.isLifetime) {
      subscriptionUntil = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
    } else {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + planConfig.days)
      subscriptionUntil = endDate.toISOString()
    }

    // ============================================
    // STEP 5: Update Supabase profile to PRO
    // ============================================
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        subscription_status: 'PRO',
        is_pro: true,
        plan: 'PRO',
        subscription_until: subscriptionUntil,
        pro_status: 'active',
        pro_expiry: subscriptionUntil,
        has_ever_been_pro: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to update Supabase profile:', updateError.message)
      return NextResponse.json(
        { error: 'Failed to update user profile', details: updateError.message },
        { status: 500 }
      )
    }

    console.log(`✅ Supabase profile updated to PRO for user: ${userProfile.id}`) // PII redacted

    // ============================================
    // STEP 5b: Also update Auth metadata so GET /api/admin/users reflects the change
    // ============================================
    try {
      const authAdmin = getAdminAuth()
      if (authAdmin) {
        await authAdmin.updateUserById(userId, {
          user_metadata: {
            is_pro: true,
            subscription_status: 'active',
            plan: 'PRO',
            subscription_until: subscriptionUntil,
            has_ever_been_pro: true,
          }
        })
        console.log(`✅ Auth metadata updated to PRO for user: ${userProfile.id}`) // PII redacted
      }
    } catch (metaErr) {
      console.error('⚠️ Auth metadata sync failed (non-blocking):', metaErr)
    }

    // ============================================
    // STEP 6: Commission — UNIFIKASI (lib bersama): ledger affiliate_referrals
    // + dedupe dobel-jalur + saldo affiliates & profiles konsisten.
    // ============================================
    const commissionAmount = Math.round(planConfig.price * planConfig.commissionRate)
    let commissionDetail = ''

    try {
      const commission = await applyActivationCommission(admin, {
        userId,
        planType: plan,
        planName: planConfig.name,
        price: planConfig.price,
        commissionRate: planConfig.commissionRate,
        subscriptionUntil: subscriptionUntil || new Date().toISOString(),
      })
      commissionDetail = commission.detail || ''
      console.log(`✅ [SUBSCRIPTION ACTIVATE] Commission result: paid=${commission.paid}, skipped=${commission.skipped || '-'}, ledger=${commission.ledger ?? '-'}, detail=${commissionDetail}`)
    } catch (commissionError) {
      console.error('❌ Commission update error (non-blocking):', commissionError)
      // Don't fail activation if commission fails
    }

    return NextResponse.json({
      success: true,
      message: `${userProfile.email} berhasil diaktifkan ke ${planConfig.name}!`,
      plan: planConfig.name,
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

// ============================================
// Plan config resolver
// ============================================
interface PlanConfig {
  name: string
  price: number
  days: number
  isLifetime: boolean
  commissionRate: number
}

function resolvePlanConfig(plan: string): PlanConfig | null {
  switch (plan) {
    case 'PRO_30_DAYS':
      return { name: 'PRO 30 Hari', price: PRICING.PRO_30_DAYS, days: 30, isLifetime: false, commissionRate: AFFILIATE_COMMISSION_RATE }
    case 'PRO_180_DAYS':
      return { name: 'PRO 180 Hari', price: PRICING.PRO_180_DAYS, days: 180, isLifetime: false, commissionRate: AFFILIATE_COMMISSION_RATE }
    case 'PRO_ANNUAL':
      return { name: 'PRO Tahunan', price: PRICING.PRO_ANNUAL, days: 365, isLifetime: false, commissionRate: AFFILIATE_COMMISSION_RATE }
    case 'PRO_LIFETIME':
      return { name: 'PRO Lifetime', price: PRICING.PRO_LIFETIME, days: 365 * 50, isLifetime: true, commissionRate: AFFILIATE_LIFETIME_RATE }
    case 'LIFETIME_ULTRA':
      return { name: 'Lifetime Ultra', price: PRICING.PRO_LIFETIME, days: 365 * 50, isLifetime: true, commissionRate: AFFILIATE_LIFETIME_RATE }
    default:
      return null
  }
}