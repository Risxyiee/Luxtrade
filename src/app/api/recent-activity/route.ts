import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// In-memory cache, 30s TTL
let cache: { data: Array<{ text_id: string; text_en: string; time: string }>; expiry: number } | null = null
const CACHE_TTL = 30_000

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

function timeAgoEn(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export async function GET() {
  try {
    if (cache && Date.now() < cache.expiry) {
      return NextResponse.json({ activities: cache.data })
    }

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ activities: [] })
    }

    // Fetch recent signups and recent trades in parallel
    const [recentSignups, recentTrades] = await Promise.all([
      svc
        .from('profiles')
        .select('full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(3),
      svc
        .from('trades')
        .select('created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const activities: Array<{ text_id: string; text_en: string; time: string }> = []

    // Add signup activities
    if (recentSignups.data) {
      for (const user of recentSignups.data) {
        const name = user.full_name?.split(' ')[0] || 'Seseorang'
        const someone = name === 'Seseorang' ? 'Someone' : name
        activities.push({
          text_id: `${name} baru bergabung`,
          text_en: `${someone} just joined`,
          time: user.created_at,
        })
      }
    }

    // Add trade activity
    if (recentTrades.data && recentTrades.data.length > 0) {
      const tradeCount = recentTrades.data.length
      const latestTradeTime = recentTrades.data[0].created_at
      // Count unique users who traded recently
      const uniqueUsers = new Set(recentTrades.data.map(t => t.user_id)).size

      activities.push({
        text_id: `${tradeCount} trade dicatat baru-baru ini`,
        text_en: `${tradeCount} trades logged recently`,
        time: latestTradeTime,
      })

      if (uniqueUsers > 1) {
        activities.push({
          text_id: `${uniqueUsers} trader aktif mencatat trade`,
          text_en: `${uniqueUsers} traders actively logging`,
          time: latestTradeTime,
        })
      }
    }

    // Sort by most recent and take top 5
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    const topActivities = activities.slice(0, 5).map(a => ({
      text_id: a.text_id,
      text_en: a.text_en,
      time: a.time,
    }))

    cache = { data: topActivities, expiry: Date.now() + CACHE_TTL }

    return NextResponse.json({ activities: topActivities })
  } catch (error) {
    console.error('[recent-activity] Error:', error)
    return NextResponse.json({ activities: [] }, { status: 500 })
  }
}
