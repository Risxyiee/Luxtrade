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

    const [totalUsers, activeUsersData, tradesLogged] = await Promise.all([
      db.profile.count(),
      db.trade.groupBy({ by: ['user_id'] }),
      db.trade.count(),
    ])

    const data = {
      totalUsers,
      activeUsers: activeUsersData.length,
      tradesLogged,
    }

    cache = { data, expiry: Date.now() + CACHE_TTL }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[landing-stats] Error:', error)
    return NextResponse.json({ totalUsers: 0, activeUsers: 0, tradesLogged: 0 }, { status: 500 })
  }
}