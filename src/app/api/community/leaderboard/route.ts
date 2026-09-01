import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// ==================== IN-MEMORY CACHE ====================
// Key: "period|sortBy" → { data, timestamp }
const leaderboardCache = new Map<string, { data: LeaderboardEntry[]; timestamp: number }>()
const CACHE_TTL = 30 * 1000 // 30 seconds (short TTL for real-time leaderboard updates)

// Expose cache invalidation for public-profile toggle
export function invalidateLeaderboardCache() {
  leaderboardCache.clear()
}

interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string | null
  winRate: number
  totalPL: number
  totalTrades: number
  streak: number
  isPro: boolean
  avatarUrl: string | null
}

function getDateFilter(period: string): string {
  const now = new Date()
  switch (period) {
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString()
    }
    case 'month': {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return d.toISOString()
    }
    case 'all':
    default:
      return new Date(0).toISOString()
  }
}

async function fetchLeaderboardFromDB(
  admin: ReturnType<typeof getSupabaseAdmin> & NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  period: string,
  sortBy: string
): Promise<LeaderboardEntry[]> {
  const dateFilter = getDateFilter(period)

  // Fetch all public profiles
  const { data: publicProfiles } = await admin.from('profiles')
    .select('id, full_name, is_pro, streak_count')
    .eq('public_profile', true)

  if (!publicProfiles || publicProfiles.length === 0) {
    return []
  }

  const userIds = publicProfiles.map((p: any) => p.id)

  // Fetch trades for these users within the date range
  const { data: trades } = await admin.from('trades')
    .select('user_id, id, profit_loss')
    .in('user_id', userIds)
    .gte('close_time', dateFilter)

  // Aggregate per user
  const userStats = new Map<string, { totalTrades: number; wins: number; totalPL: number }>()

  if (trades) {
    for (const t of trades) {
      const existing = userStats.get(t.user_id) || { totalTrades: 0, wins: 0, totalPL: 0 }
      userStats.set(t.user_id, {
        totalTrades: existing.totalTrades + 1,
        wins: existing.wins + (Number(t.profit_loss) > 0 ? 1 : 0),
        totalPL: existing.totalPL + Number(t.profit_loss || 0),
      })
    }
  }

  // Build entries for users with at least 1 trade
  let entries: LeaderboardEntry[] = publicProfiles
    .map((p: any) => {
      const stats = userStats.get(p.id)
      if (!stats || stats.totalTrades < 1) return null
      return {
        rank: 0,
        userId: p.id,
        displayName: p.full_name,
        winRate: stats.totalTrades > 0
          ? Math.round((stats.wins / stats.totalTrades) * 1000) / 10
          : 0,
        totalPL: Math.round(stats.totalPL * 100) / 100,
        totalTrades: stats.totalTrades,
        streak: p.streak_count || 0,
        isPro: p.is_pro || false,
        avatarUrl: null,
      }
    })
    .filter((e): e is LeaderboardEntry => e !== null)

  // Sort by the requested field
  switch (sortBy) {
    case 'winRate':
      entries.sort((a, b) => b.winRate - a.winRate)
      break
    case 'totalTrades':
      entries.sort((a, b) => b.totalTrades - a.totalTrades)
      break
    case 'totalPL':
    default:
      entries.sort((a, b) => b.totalPL - a.totalPL)
      break
  }

  // Assign ranks and limit to 20
  entries = entries.slice(0, 20).map((e, i) => ({ ...e, rank: i + 1 }))

  return entries
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ leaderboard: [] })
  }

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const sortBy = searchParams.get('sortBy') || 'totalPL'
    const refresh = searchParams.get('refresh') === '1'

    const cacheKey = `${period}|${sortBy}`
    const cached = leaderboardCache.get(cacheKey)
    const now = Date.now()

    if (!refresh && cached && now - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ leaderboard: cached.data })
    }

    const data = await fetchLeaderboardFromDB(admin, period, sortBy)
    leaderboardCache.set(cacheKey, { data, timestamp: now })

    return NextResponse.json({ leaderboard: data })
  } catch (err: any) {
    console.error('[Leaderboard API] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
