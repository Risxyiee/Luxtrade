import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthUser } from '@/lib/api-auth'

// In-memory cache for affiliate referrals (30s TTL)
const referralCache = new Map<string, { data: any; expiry: number }>()
const CACHE_TTL = 30_000 // 30 seconds

// GET /api/affiliate/referrals - Get current user's referral list
export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check cache first
    const cached = referralCache.get(authUser.id)
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data)
    }

    // Find the affiliate record for this user
    const { data: affiliate } = await admin.from('affiliates').select('id').eq('user_id', authUser.id).maybeSingle()

    if (!affiliate) {
      return NextResponse.json({ referrals: [] })
    }

    // Get all referrals for this affiliate
    const { data: referrals } = await admin.from('affiliate_referrals')
      .select('id, referred_user_id, subscription_type, commission_amount, status, created_at')
      .eq('affiliate_id', affiliate.id)
      .order('created_at', { ascending: false })

    // BATCH profile lookup — single query instead of N queries (fixes N+1)
    const enrichedReferrals = referrals && referrals.length > 0
      ? await batchEnrichReferrals(admin, referrals)
      : []

    const responseData = { referrals: enrichedReferrals }

    // Cache the result
    referralCache.set(authUser.id, { data: responseData, expiry: Date.now() + CACHE_TTL })

    // Add Cache-Control header
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    })
  } catch (error) {
    console.error('Affiliate referrals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Batch-enrich referrals with profile data.
 */
async function batchEnrichReferrals(
  admin: ReturnType<typeof getSupabaseAdmin> & NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  referrals: { id: string; referred_user_id: string; subscription_type: string; commission_amount: number; status: string; created_at: string }[]
) {
  const userIds = referrals.map(r => r.referred_user_id)

  // Single batch query for all profiles
  const { data: profiles } = await admin.from('profiles')
    .select('id, email, full_name, created_at')
    .in('id', userIds)

  // Build lookup map for O(1) access
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Count trades per user in last 30 days with sum P/L
  const { data: trades30d } = await admin.from('trades')
    .select('user_id, id, profit_loss')
    .in('user_id', userIds)
    .gte('close_time', thirtyDaysAgo)

  const activityMap = new Map<string, { count: number; pl: number }>()
  if (trades30d) {
    for (const t of trades30d) {
      const existing = activityMap.get(t.user_id) || { count: 0, pl: 0 }
      activityMap.set(t.user_id, {
        count: existing.count + 1,
        pl: existing.pl + (Number(t.profit_loss) || 0),
      })
    }
  }

  // Count trades in last 7 days separately for "active this week"
  const { data: trades7d } = await admin.from('trades')
    .select('user_id, id')
    .in('user_id', userIds)
    .gte('close_time', sevenDaysAgo)

  const recentMap = new Map<string, number>()
  if (trades7d) {
    for (const t of trades7d) {
      recentMap.set(t.user_id, (recentMap.get(t.user_id) || 0) + 1)
    }
  }

  return referrals.map(referral => {
    const profile = profileMap.get(referral.referred_user_id)
    const activity = activityMap.get(referral.referred_user_id)
    const recentCount = recentMap.get(referral.referred_user_id) || 0

    // Determine activity level
    let activityLevel: 'active' | 'recent' | 'inactive' = 'inactive'
    if (recentCount > 0) {
      activityLevel = 'active'
    } else if (activity && activity.count > 0) {
      activityLevel = 'recent'
    }

    return {
      id: referral.id,
      referredEmail: profile?.email || null,
      referredName: profile?.full_name || null,
      referredJoinedAt: profile?.created_at || null,
      subscriptionType: referral.subscription_type,
      commissionAmount: referral.commission_amount,
      status: referral.status,
      createdAt: referral.created_at,
      // Enriched activity data
      activityLevel,
      totalTrades30d: activity?.count || 0,
      totalPnL30d: activity?.pl || 0,
      recentTrades7d: recentCount,
    }
  })
}