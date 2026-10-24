import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { sendEmail, getDailyReminderHtml, type DailyReminderNewsItem } from '@/lib/email'
import { getEnvVar } from '@/lib/cloudflare-bindings'

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

async function getTargetUsers(targetUid?: string): Promise<TargetUser[]> {
  const uidFilter = targetUid ? Prisma.sql`AND p.id = ${targetUid}` : Prisma.empty

  const rows: any[] = await db.$queryRaw`
    SELECT
      p.id AS user_id,
      p.email,
      p.full_name,
      COALESCE(p.streak_count, 0)::int AS streak_count,
      COALESCE(p.best_streak, 0)::int AS best_streak
    FROM public.profiles p
    WHERE p.email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.trades t
        WHERE t.user_id = p.id
        LIMIT 1
      )
      -- Active in last 14 days
      AND (
        p.last_login_at >= NOW() - interval '14 days'
        OR EXISTS (
          SELECT 1 FROM public.trades t2
          WHERE t2.user_id = p.id
            AND t2.close_time >= NOW() - interval '14 days'
          LIMIT 1
        )
      )
      -- Not already sent today
      AND NOT EXISTS (
        SELECT 1 FROM public.daily_reminder_logs drl
        WHERE drl.user_id = p.id
          AND drl.sent_date = CURRENT_DATE
      )
      -- Not unsubscribed
      AND NOT EXISTS (
        SELECT 1 FROM public.daily_reminder_logs drl2
        WHERE drl2.user_id = p.id
          AND drl2.unsubscribed = true
      )
      ${uidFilter}
    ORDER BY p.streak_count DESC;`

  return rows.map((r: any) => ({
    user_id: r.user_id,
    email: r.email,
    full_name: r.full_name || r.email?.split('@')[0] || 'Trader',
    streak_count: r.streak_count,
    best_streak: r.best_streak,
  }))
}

async function getWeeklyStats(userId: string): Promise<{ trades: number; pnl: number }> {
  const rows: any[] = await db.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS trade_count,
      COALESCE(SUM(profit_loss), 0)::numeric::float8 AS total_pnl
    FROM public.trades
    WHERE user_id = $1
      AND close_time >= date_trunc('week', NOW())
  `, userId)

  if (!rows || rows.length === 0) return { trades: 0, pnl: 0 }
  return { trades: Number(rows[0].trade_count), pnl: Number(rows[0].total_pnl) }
}

async function logSentEmail(user: TargetUser, success: boolean): Promise<void> {
  try {
    await db.$executeRawUnsafe(`
      INSERT INTO public.daily_reminder_logs (user_id, email, sent_date)
      VALUES ($1, $2, CURRENT_DATE)
      ON CONFLICT (user_id, sent_date) DO NOTHING;
    `, user.user_id, user.email)
  } catch (err: any) {
    if (!err.code || err.code !== '23505') {
      console.warn(`[daily-reminder] Failed to log for ${user.user_id}:`, err.message)
    }
  }
}

async function sendDailyReminder(
  user: TargetUser,
  news: DailyReminderNewsItem[]
): Promise<boolean> {
  const name = user.full_name || 'Trader'
  const dayName = getDayName()
  const ctaUrl = `${SITE_URL}/dashboard`
  const unsubUrl = `${SITE_URL}/api/cron/daily-reminder/unsubscribe?uid=${user.user_id}`

  // Get this week's stats
  const weekStats = await getWeeklyStats(user.user_id)

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

  // Auth check
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!force && process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not available', sent: 0 })
  }

  try {
    const users = await getTargetUsers(targetUid)

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
        const success = await sendDailyReminder(user, news)
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
