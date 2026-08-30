import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { isDatabaseAvailable } from '@/lib/db'

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

function getDateFilter(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    case 'month': {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return d
    }
    case 'all':
    default:
      return new Date(0)
  }
}

function getSortClause(sortBy: string): string {
  switch (sortBy) {
    case 'winRate': return 'win_rate DESC'
    case 'totalPL': return 'total_pl DESC'
    case 'totalTrades': return 'total_trades DESC'
    default: return 'total_pl DESC'
  }
}

async function ensurePublicProfileColumn() {
  try {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'profiles' AND column_name = 'public_profile'
        ) THEN
          ALTER TABLE profiles ADD COLUMN public_profile BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$;
    `)
  } catch {
    // Column may already exist or table doesn't exist — safe to ignore
  }
}

async function ensureSharedTradesTable() {
  try {
    // Fix existing table if it was created with wrong UUID type for trade_id
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Check if table exists with wrong trade_id type (uuid instead of text)
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'shared_trades' AND column_name = 'trade_id' AND data_type = 'uuid'
        ) THEN
          -- Drop and recreate with correct types
          DROP TABLE IF EXISTS shared_trades CASCADE;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'shared_trades'
        ) THEN
          CREATE TABLE shared_trades (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            trade_id TEXT NOT NULL UNIQUE REFERENCES trades(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            share_code TEXT NOT NULL UNIQUE,
            include_analytics BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT now()
          );
          CREATE INDEX idx_shared_trades_user_id ON shared_trades(user_id);
          CREATE INDEX idx_shared_trades_share_code ON shared_trades(share_code);
        END IF;
      END $$;
    `)
  } catch {
    // Table may already exist — safe to ignore
  }
}

async function fetchLeaderboardFromDB(period: string, sortBy: string): Promise<LeaderboardEntry[]> {
  const dateFilter = getDateFilter(period)
  const sortClause = getSortClause(sortBy)

  // Use raw SQL for complex aggregation across trades + profiles
  const results = await db.$queryRawUnsafe<{
    user_id: string
    display_name: string | null
    is_pro: boolean
    streak_count: number
    total_trades: bigint
    wins: bigint
    total_pl: number
  }[]>(`
    SELECT 
      p.id as user_id,
      p.full_name as display_name,
      p.is_pro,
      p.streak_count,
      COUNT(t.id) as total_trades,
      COUNT(CASE WHEN t.profit_loss > 0 THEN 1 END) as wins,
      COALESCE(SUM(t.profit_loss), 0) as total_pl
    FROM profiles p
    INNER JOIN trades t ON t.user_id = p.id
    WHERE p.public_profile = true
      AND t.close_time >= $1::timestamp
    GROUP BY p.id, p.full_name, p.is_pro, p.streak_count
    HAVING COUNT(t.id) >= 1
    ORDER BY ${sortClause}
    LIMIT 20
  `, dateFilter.toISOString())

  return results.map((row, index) => ({
    rank: index + 1,
    userId: row.user_id,
    displayName: row.display_name,
    winRate: row.total_trades > 0n 
      ? Math.round((Number(row.wins) / Number(row.total_trades)) * 1000) / 10 
      : 0,
    totalPL: Math.round(row.total_pl * 100) / 100,
    totalTrades: Number(row.total_trades),
    streak: row.streak_count,
    isPro: row.is_pro,
    avatarUrl: null,
  }))
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ leaderboard: [] })
  }

  try {
    // Ensure columns/tables exist
    await ensurePublicProfileColumn()
    await ensureSharedTradesTable()

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

    const data = await fetchLeaderboardFromDB(period, sortBy)
    leaderboardCache.set(cacheKey, { data, timestamp: now })

    return NextResponse.json({ leaderboard: data })
  } catch (err: any) {
    console.error('[Leaderboard API] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
