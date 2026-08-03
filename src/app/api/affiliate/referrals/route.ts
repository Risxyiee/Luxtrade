import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// In-memory cache for affiliate referrals (30s TTL)
const referralCache = new Map<string, { data: any; expiry: number }>()
const CACHE_TTL = 30_000 // 30 seconds

// GET /api/affiliate/referrals - Get current user's referral list
export async function GET(request: NextRequest) {
  try {
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
    const affiliate = await db.affiliate.findUnique({
      where: { userId: authUser.id },
    })

    if (!affiliate) {
      return NextResponse.json({ referrals: [] })
    }

    // Get all referrals for this affiliate
    const referrals = await db.affiliateReferral.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        referredUserId: true,
        subscriptionType: true,
        commissionAmount: true,
        status: true,
        createdAt: true,
      },
    })

    // BATCH profile lookup — single query instead of N queries (fixes N+1)
    const enrichedReferrals = referrals.length > 0
      ? await batchEnrichReferrals(referrals)
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
 * Batch-enrich referrals with profile data using a single IN query.
 * Replaces the old N+1 pattern (1 query per referral).
 */
async function batchEnrichReferrals(
  referrals: { id: string; referredUserId: string; subscriptionType: string; commissionAmount: number; status: string; createdAt: Date }[]
) {
  const userIds = referrals.map(r => r.referredUserId)

  // Single batch query for all profiles
  const profiles = await db.profile.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, full_name: true, created_at: true },
  })

  // Build lookup map for O(1) access
  const profileMap = new Map(profiles.map(p => [p.id, p]))

  // Also batch-count trades per referred user for activity status
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Count trades per user in last 30 days (single query with groupBy)
  const tradeActivity = await db.trade.groupBy({
    by: ['user_id'],
    where: {
      user_id: { in: userIds },
      close_time: { gte: thirtyDaysAgo },
    },
    _count: { id: true },
    _sum: { profit_loss: true },
  })

  const activityMap = new Map(
    tradeActivity.map(t => [t.user_id, { count: t._count.id, pl: t._sum.profit_loss || 0 }])
  )

  // Count trades in last 7 days separately for "active this week"
  const recentActivity = await db.trade.groupBy({
    by: ['user_id'],
    where: {
      user_id: { in: userIds },
      close_time: { gte: sevenDaysAgo },
    },
    _count: { id: true },
  })

  const recentMap = new Map(recentActivity.map(t => [t.user_id, t._count.id]))

  return referrals.map(referral => {
    const profile = profileMap.get(referral.referredUserId)
    const activity = activityMap.get(referral.referredUserId)
    const recentCount = recentMap.get(referral.referredUserId) || 0

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
      subscriptionType: referral.subscriptionType,
      commissionAmount: referral.commissionAmount,
      status: referral.status,
      createdAt: referral.createdAt,
      // Enriched activity data
      activityLevel,
      totalTrades30d: activity?.count || 0,
      totalPnL30d: activity?.pl || 0,
      recentTrades7d: recentCount,
    }
  })
}
