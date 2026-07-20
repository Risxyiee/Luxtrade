import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

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

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ totalUsers: 0, activeUsers: 0, tradesLogged: 0 })
    }

    // Run queries in parallel for speed (all via Supabase — no Prisma)
    const [profilesRes, activeRes, tradesRes] = await Promise.all([
      // Total registered users
      svc.from('profiles').select('id', { count: 'exact', head: true }),

      // Active users = logged in within last 30 days
      svc.from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('last_login_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // Total trades logged
      svc.from('trades').select('id', { count: 'exact', head: true }),
    ])

    const totalUsers = profilesRes.count ?? 0
    const activeUsers = activeRes.count ?? 0
    const tradesLogged = tradesRes.count ?? 0

    const data = { totalUsers, activeUsers, tradesLogged }
    cache = { data, expiry: Date.now() + CACHE_TTL }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[landing-stats] Error:', error)
    return NextResponse.json({ totalUsers: 0, activeUsers: 0, tradesLogged: 0 }, { status: 500 })
  }
}
