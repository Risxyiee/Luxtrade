import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, getDailyReminderHtml, type DailyReminderNewsItem } from '@/lib/email'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin, fetchAllRows, isMissingTableError, chunk } from '@/lib/cron-supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * GET/POST /api/cron/daily-reminder
 * Cron job: sends daily reminder email every morning to active users.
 *
 * Targets users who:
 *   - Have at least 1 trade (they've used the product)
 *   - Logged in within the last 14 days (active users)
 *   - Haven't unsubscribed
 *   - Haven't received a reminder today yet
 *
 * Shows: streak count, best streak, weekly trades + PnL
 * Subject changes based on streak level for variety.
 *
 * Supported params:
 *   ?dry=true       — preview users without sending
 *   ?force=true     — bypass auth + send to all active users
 *   ?uid=xxx        — send to single user (for testing)
 *
 * Cron: runs daily at 08:00 WIB (01:00 UTC) via Cloudflare Workers cron trigger
 */
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

interface TargetUser {
  user_id: string
  email: string
  full_name: string | null
  streak_count: number
  best_streak: number
}

function getDayName(): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  return days[new Date().getDay()]
}

/**
 * Fetch today's top market news for the daily reminder email.
 * Sources (in order):
 *   1. Finnhub forex news (FREE, FINNHUB_API_KEY already set in Cloudflare)
 *   2. Finnhub general news (fallback category)
 *
 * Returns max 3 items. On any failure returns [] — email still sends without news.
 */
async function fetchDailyNews(): Promise<DailyReminderNewsItem[]> {
  try {
    const apiKey = (await getEnvVar('FINNHUB_API_KEY')) || process.env.FINNHUB_API_KEY || ''
    if (!apiKey) {
      console.warn('[daily-reminder] FINNHUB_API_KEY not set — skipping news section')
      return []
    }

    // Try forex category first, then general as fallback
    for (const category of ['forex', 'general']) {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`,
          { headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) }
        )
        if (!res.ok) {
          console.warn(`[daily-reminder] Finnhub ${category} returned ${res.status}`)
          continue
        }
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) continue

        // Dedupe by headline, filter out items without image-free titles, take top 3
        const seen = new Set<string>()
        const items: DailyReminderNewsItem[] = []
        for (const item of data) {
          const title = (item.headline || '').trim()
          const url = (item.url || '').trim()
          if (!title || !url || seen.has(title)) continue
          // Skip extremely long titles (broken data)
          if (title.length > 160) continue
          seen.add(title)
          items.push({
            title,
            source: item.source || 'Finnhub',
            url,
          })
          if (items.length >= 3) break
        }
        if (items.length > 0) {
          console.log(`[daily-reminder] Fetched ${items.length} news items from Finnhub/${category}`)
          return items
        }
      } catch (err: any) {
        console.warn(`[daily-reminder] Finnhub ${category} failed:`, err.message)
      }
    }
    return []
  } catch (err: any) {
    console.warn('[daily-reminder] News fetch failed (email will send without news):', err.message)
    return []
  }
}

/**
 * Users are targeted via Supabase REST (Prisma cannot run on CF Workers —
 * its engine calls fs.readdir which unenv throws on):
 *   - email present
 *   - at least 1 trade
 *   - recent trade in last 14 days OR login in last 14 days
 *   - not already sent today + not unsubscribed (daily_reminder_logs)
 */
async function getTargetUsers(admin: SupabaseClient, targetUid?: string): Promise<TargetUser[]> {
  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
  const todayStr = new Date().toISOString().slice(0, 10)

  // 1. All profiles with an email
  const profiles = await fetchAllRows<any>((from, to) =>
    admin.from('profiles')
      .select('id, email, full_name, streak_count, best_streak, last_login_at')
      .not('email', 'is', null)
      .order('streak_count', { ascending: false })
      .range(from, to)
  )

  // 2. Users with a trade closed in the last 14 days (implies active + has trade)
  const recentTradeSet = new Set<string>()
  const recentRows = await fetchAllRows<any>((from, to) =>
    admin.from('trades').select('user_id').gte('close_time', cutoff).range(from, to)
  )
  recentRows.forEach((r: any) => recentTradeSet.add(r.user_id))

  // 3. For login-active users (no recent trade), verify they have ANY trade
  const loginActiveIds = profiles
    .filter((p: any) => p.last_login_at && new Date(p.last_login_at).getTime() >= new Date(cutoff).getTime())
    .map((p: any) => p.id)
  const anyTradeSet = new Set<string>()
  for (const c of chunk(loginActiveIds, 100)) {
    const rows = await fetchAllRows<any>((from, to) =>
      admin.from('trades').select('user_id').in('user_id', c).range(from, to)
    )
    rows.forEach((r: any) => anyTradeSet.add(r.user_id))
  }

  // 4. Already sent today / unsubscribed (log table may not exist yet — degrade gracefully)
  const sentSet = new Set<string>()
  const unsubSet = new Set<string>()
  try {
    const sentRows = await fetchAllRows<any>((from, to) =>
      admin.from('daily_reminder_logs').select('user_id').eq('sent_date', todayStr).range(from, to)
    )
    sentRows.forEach((r: any) => sentSet.add(r.user_id))
  } catch (err: any) {
    if (!isMissingTableError(err)) console.warn('[daily-reminder] sent_date query failed:', err.message)
  }
  try {
    const unsubRows = await fetchAllRows<any>((from, to) =>
      admin.from('daily_reminder_logs').select('user_id').eq('unsubscribed', true).range(from, to)
    )
    unsubRows.forEach((r: any) => unsubSet.add(r.user_id))
  } catch (err: any) {
    if (!isMissingTableError(err)) console.warn('[daily-reminder] unsubscribed query failed:', err.message)
  }

  return profiles
    .filter((p: any) => {
      if (targetUid && p.id !== targetUid) return false
      if (!p.email) return false
      const hasTrade = recentTradeSet.has(p.id) || anyTradeSet.has(p.id)
      if (!hasTrade) return false
      const isActive = recentTradeSet.has(p.id) ||
        (p.last_login_at && new Date(p.last_login_at).getTime() >= new Date(cutoff).getTime())
      if (!isActive) return false
      if (sentSet.has(p.id) || unsubSet.has(p.id)) return false
      return true
    })
    .map((p: any) => ({
      user_id: p.id,
      email: p.email,
      full_name: p.full_name || p.email?.split('@')[0] || 'Trader',
      streak_count: p.streak_count || 0,
      best_streak: p.best_streak || 0,
    }))
}

async function getWeeklyStats(admin: SupabaseClient, userId: string): Promise<{ trades: number; pnl: number }> {
  // Monday 00:00 UTC — same as date_trunc('week', NOW())
  const weekStart = new Date()
  const day = weekStart.getUTCDay()
  weekStart.setUTCDate(weekStart.getUTCDate() - (day === 0 ? 6 : day - 1))
  weekStart.setUTCHours(0, 0, 0, 0)

  const rows = await fetchAllRows<any>((from, to) =>
    admin.from('trades')
      .select('profit_loss')
      .eq('user_id', userId)
      .gte('close_time', weekStart.toISOString())
      .range(from, to)
  )

  return {
    trades: rows.length,
    pnl: rows.reduce((sum: number, r: any) => sum + Number(r.profit_loss || 0), 0),
  }
}

async function logSentEmail(user: TargetUser, success: boolean): Promise<void> {
  const admin = await getCronAdmin()
  if (!admin) return
  try {
    const todayStr = new Date().toISOString().slice(0, 10)
    const { error } = await admin.from('daily_reminder_logs')
      .upsert(
        { user_id: user.user_id, email: user.email, sent_date: todayStr },
        { onConflict: 'user_id,sent_date', ignoreDuplicates: true }
      )
    if (error && !isMissingTableError(error)) {
      console.warn(`[daily-reminder] Failed to log for ${user.user_id}:`, error.message)
    }
  } catch (err: any) {
    if (!isMissingTableError(err)) {
      console.warn(`[daily-reminder] Failed to log for ${user.user_id}:`, err.message)
    }
  }
}

async function sendDailyReminder(
  admin: SupabaseClient,
  user: TargetUser,
  news: DailyReminderNewsItem[]
): Promise<boolean> {
  const name = user.full_name || 'Trader'
  const dayName = getDayName()
  const ctaUrl = `${SITE_URL}/dashboard`
  const unsubUrl = `${SITE_URL}/api/cron/daily-reminder/unsubscribe?uid=${user.user_id}`

  // Get this week's stats
  const weekStats = await getWeeklyStats(admin, user.user_id)

  const html = getDailyReminderHtml({
    name,
    streak: user.streak_count,
    bestStreak: user.best_streak,
    tradesThisWeek: weekStats.trades,
    pnlThisWeek: weekStats.pnl,
    dayName,
    ctaUrl,
    unsubUrl,
    news,
  })

  // Dynamic subject based on streak
  let subject: string
  if (user.streak_count === 0) {
    subject = `💪 Mulai streak barumu hari ini! — LuxTradee`
  } else if (user.streak_count < 7) {
    subject = `🔥 Streak ${user.streak_count} hari! Jangan putus — LuxTradee`
  } else if (user.streak_count < 30) {
    subject = `⚡ ${user.streak_count} hari streak! Kamu luar biasa — LuxTradee`
  } else {
    subject = `👑 ${user.streak_count} HARI STREAK! Legendary — LuxTradee`
  }

  const result = await sendEmail({ to: user.email, subject, html })
  return result.success
}

export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const dry = searchParams.get('dry') === 'true'
  const force = searchParams.get('force') === 'true'
  const targetUid = searchParams.get('uid') || undefined

  // Auth check (getEnvVar reads CF bindings/secrets reliably on Workers)
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  const expectedSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!force && expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Database not available', sent: 0 })
  }

  try {
    const users = await getTargetUsers(admin, targetUid)

    // Fetch market news ONCE for all users (Finnhub free tier: 60 calls/min)
    const news = users.length > 0 ? await fetchDailyNews() : []

    if (users.length === 0) {
      return NextResponse.json({
        message: 'No active users to remind',
        sent: 0,
        day: getDayName(),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Dry run
    if (dry) {
      return NextResponse.json({
        message: `DRY RUN — would send ${users.length} daily reminders`,
        sent: 0,
        day: getDayName(),
        newsCount: news.length,
        news: news.map(n => ({ title: n.title, source: n.source })),
        users: users.map(u => ({
          user_id: u.user_id,
          email: u.email,
          name: u.full_name,
          streak: u.streak_count,
          best_streak: u.best_streak,
        })),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Send emails
    let sentCount = 0
    let failCount = 0
    const results: { email: string; success: boolean; streak: number }[] = []

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      try {
        const success = await sendDailyReminder(admin, user, news)
        await logSentEmail(user, success)

        if (success) {
          sentCount++
          console.log(`✅ [daily-reminder] Sent to ${user.email} (streak: ${user.streak_count})`)
        } else {
          failCount++
          console.warn(`⚠️ [daily-reminder] Failed to send to ${user.email}`)
        }

        results.push({ email: user.email, success, streak: user.streak_count })

        // Delay (Resend rate limit)
        if (i < users.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (err: any) {
        failCount++
        console.error(`❌ [daily-reminder] Error for ${user.email}:`, err.message)
        results.push({ email: user.email, success: false, streak: user.streak_count })
      }
    }

    return NextResponse.json({
      message: `Daily reminder: sent ${sentCount} emails, ${failCount} failed`,
      sent: sentCount,
      failed: failCount,
      total: users.length,
      day: getDayName(),
      newsCount: news.length,
      results,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (error: any) {
    console.error('[cron/daily-reminder] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
