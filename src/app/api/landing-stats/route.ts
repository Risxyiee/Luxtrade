import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// In-memory cache — avoids hitting DB on every landing page visit.
// Stats are not critical real-time data, 60s staleness is fine.
let cache: { data: { totalUsers: number; activeUsers: number; tradesLogged: number }; expiry: number } | null = null
const CACHE_TTL = 60_000 // 60 seconds

export async function GET() {
  try {
    // Return cached data if still fresh
    if (cache && Date.now() < cache.expiry) {
      return NextResponse.json(cache.data)
    }

    // Run queries in parallel for speed
    const [totalUsers, activeUsersResult, tradesLogged] = await Promise.all([
      // Total registered users (all profiles)
      db.profile.count(),

      // Active users = logged in within last 30 days
      db.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT COUNT(*)::bigint as count FROM profiles
        WHERE last_login_at > NOW() - INTERVAL '30 days'
      `),

      // Total trades logged
      db.trade.count(),
    ])

    const activeUsers = Number(activeUsersResult[0]?.count || 0)

    const data = {
      totalUsers,
      activeUsers,
      tradesLogged,
    }

    cache = { data, expiry: Date.now() + CACHE_TTL }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[landing-stats] Error:', error)
    return NextResponse.json({ totalUsers: 0, activeUsers: 0, tradesLogged: 0 }, { status: 500 })
  }
}