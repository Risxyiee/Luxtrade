export const runtime = "edge"
import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { sendEmail, getWeeklySummaryHtml } from '@/lib/email'

/**
 * GET/POST /api/cron/weekly-summary
 * Cron job: sends weekly trading summary email every Monday.
 *
 * Queries all users who had trades in the PREVIOUS week (Mon-Sun),
 * calculates their stats (PnL, win rate, best/worst trade, streak),
 * and sends a personalized weekly report email.
 *
 * Only sends ONCE per user per week (tracked in weekly_summary_emails table).
 * Skips unsubscribed users.
 *
 * Supported params:
 *   ?dry=true       — preview users without sending
 *   ?force=true     — ignore week window, use current data
 *   ?uid=xxx        — send to a single user (for testing)
 *   ?week=YYYY-MM-DD — override week start date (default: last Monday)
 *
 * Vercel Cron: runs every Monday at 10:00 AM WIB (03:00 UTC)
 */
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

interface WeeklyStats {
  user_id: string
  email: string
  full_name: string | null
  trade_count: number
  total_pnl: number
  win_count: number
  loss_count: number
  best_trade: number
  worst_trade: number
  streak_count: number
}

function getLastMonday(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const fmt = (d: Date) => `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`
}

async function getWeeklyStats(weekStart: Date, weekEnd: Date, targetUid?: string): Promise<WeeklyStats[]> {
  const uidFilter = targetUid ? `AND p.id = '${targetUid}'` : ''

  const rows: any[] = await db.$queryRawUnsafe(`
    WITH week_trades AS (
      SELECT
        t.user_id,
        t.profit_loss,
        t.symbol
      FROM public.trades t
      WHERE t.close_time >= $1::timestamptz
        AND t.close_time < $2::timestamptz
    )
    SELECT
      p.id AS user_id,
      p.email,
      p.full_name,
      COALESCE(wt_agg.trade_count, 0)::int AS trade_count,
      COALESCE(wt_agg.total_pnl, 0)::numeric::float8 AS total_pnl,
      COALESCE(wt_agg.win_count, 0)::int AS win_count,
      COALESCE(wt_agg.loss_count, 0)::int AS loss_count,
      COALESCE(wt_agg.best_trade, 0)::numeric::float8 AS best_trade,
      COALESCE(wt_agg.worst_trade, 0)::numeric::float8 AS worst_trade,
      COALESCE(p.streak_count, 0)::int AS streak_count
    FROM public.profiles p
    INNER JOIN (
      SELECT
        user_id,
        COUNT(*) AS trade_count,
        COALESCE(SUM(profit_loss), 0) AS total_pnl,
        COUNT(*) FILTER (WHERE profit_loss > 0) AS win_count,
        COUNT(*) FILTER (WHERE profit_loss <= 0) AS loss_count,
        COALESCE(MAX(profit_loss) FILTER (WHERE profit_loss > 0), 0) AS best_trade,
        COALESCE(MIN(profit_loss) FILTER (WHERE profit_loss < 0), 0) AS worst_trade
      FROM week_trades
      GROUP BY user_id
    ) wt_agg ON wt_agg.user_id = p.id
    WHERE p.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.weekly_summary_emails wse
        WHERE wse.user_id = p.id
          AND wse.week_start = ($1::timestamptz)::date
          AND wse.unsubscribed = false
      )
      -- Exclude users who unsubscribed from ALL weekly emails
      AND NOT EXISTS (
        SELECT 1 FROM public.weekly_summary_emails wse2
        WHERE wse2.user_id = p.id
          AND wse2.unsubscribed = true
      )
      ${uidFilter}
    ORDER BY wt_agg.trade_count DESC;
  `, weekStart.toISOString(), weekEnd.toISOString())

  return rows.map((r: any) => ({
    user_id: r.user_id,
    email: r.email,
    full_name: r.full_name || r.email?.split('@')[0] || 'Trader',
    trade_count: r.trade_count,
    total_pnl: Number(r.total_pnl),
    win_count: r.win_count,
    loss_count: r.loss_count,
    best_trade: Number(r.best_trade),
    worst_trade: Number(r.worst_trade),
    streak_count: r.streak_count,
  }))
}

async function getTopSymbols(userId: string, weekStart: Date, weekEnd: Date): Promise<{ symbol: string; count: number }[]> {
  const rows: any[] = await db.$queryRawUnsafe(`
    SELECT
      UPPER(symbol) AS symbol,
      COUNT(*) AS count
    FROM public.trades
    WHERE user_id = $1
      AND close_time >= $2::timestamptz
      AND close_time < $3::timestamptz
    GROUP BY UPPER(symbol)
    ORDER BY count DESC
    LIMIT 5;
  `, userId, weekStart.toISOString(), weekEnd.toISOString())

  return rows.map((r: any) => ({
    symbol: r.symbol,
    count: Number(r.count),
  }))
}

async function logSentEmail(stats: WeeklyStats, weekStart: Date, weekEnd: Date, success: boolean): Promise<void> {
  try {
    await db.$executeRawUnsafe(`
      INSERT INTO public.weekly_summary_emails (
        user_id, email, week_start, week_end,
        trade_count, total_pnl, win_count, loss_count,
        best_trade, worst_trade, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (user_id, week_start) DO NOTHING;
    `, stats.user_id, stats.email, weekStart, weekEnd,
       stats.trade_count, stats.total_pnl, stats.win_count, stats.loss_count,
       stats.best_trade, stats.worst_trade)
  } catch (err: any) {
    if (!err.code || err.code !== '23505') {
      console.warn(`[weekly-summary] Failed to log email for ${stats.user_id}:`, err.message)
    }
  }
}

async function sendWeeklyEmail(
  stats: WeeklyStats,
  topSymbols: { symbol: string; count: number }[],
  weekStart: Date,
  weekEnd: Date,
): Promise<boolean> {
  const name = stats.full_name || 'Trader'
  const weekLabel = formatWeekLabel(weekStart, weekEnd)
  const ctaUrl = `${SITE_URL}/dashboard`
  const unsubUrl = `${SITE_URL}/api/cron/weekly-summary/unsubscribe?uid=${stats.user_id}`

  const winRate = stats.trade_count > 0
    ? Math.round((stats.win_count / stats.trade_count) * 100)
    : 0

  const html = getWeeklySummaryHtml({
    name,
    weekLabel,
    tradeCount: stats.trade_count,
    pnl: stats.total_pnl,
    winRate,
    winCount: stats.win_count,
    lossCount: stats.loss_count,
    bestTrade: stats.best_trade,
    worstTrade: stats.worst_trade,
    streak: stats.streak_count,
    topSymbols,
    ctaUrl,
    unsubUrl,
  })

  const subject = `📊 Weekly Report: ${stats.trade_count} trades ${stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })} PnL — LuxTrade`

  const result = await sendEmail({ to: stats.email, subject, html })
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
  const weekOverride = searchParams.get('week')

  // Auth check
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!force && process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not available', sent: 0 })
  }

  try {
    // Calculate week window
    let weekStart = getLastMonday()
    if (weekOverride) {
      const parsed = new Date(weekOverride)
      if (!isNaN(parsed.getTime())) {
        weekStart = parsed
        weekStart.setHours(0, 0, 0, 0)
      }
    }
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    console.log(`📊 [weekly-summary] Week: ${weekStart.toISOString()} → ${weekEnd.toISOString()}`)

    // Get users with weekly stats
    const users = await getWeeklyStats(weekStart, weekEnd, targetUid)

    if (users.length === 0) {
      return NextResponse.json({
        message: 'No users with trades this week',
        sent: 0,
        week: formatWeekLabel(weekStart, new Date(weekEnd.getTime() - 1)),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Dry run
    if (dry) {
      return NextResponse.json({
        message: `DRY RUN — would send ${users.length} weekly summary emails`,
        sent: 0,
        week: formatWeekLabel(weekStart, new Date(weekEnd.getTime() - 1)),
        users: users.map(u => ({
          user_id: u.user_id,
          email: u.email,
          name: u.full_name,
          trade_count: u.trade_count,
          total_pnl: u.total_pnl,
          win_count: u.win_count,
          loss_count: u.loss_count,
          streak: u.streak_count,
        })),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Send emails
    let sentCount = 0
    let failCount = 0
    const results: { email: string; success: boolean; trades: number }[] = []

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      try {
        const topSymbols = await getTopSymbols(user.user_id, weekStart, weekEnd)
        const success = await sendWeeklyEmail(user, topSymbols, weekStart, weekEnd)
        await logSentEmail(user, weekStart, weekEnd, success)

        if (success) {
          sentCount++
          console.log(`✅ [weekly-summary] Sent to ${user.email} (${user.trade_count} trades, PnL: ${user.total_pnl})`)
        } else {
          failCount++
          console.warn(`⚠️ [weekly-summary] Failed to send to ${user.email}`)
        }

        results.push({ email: user.email, success, trades: user.trade_count })

        // Delay between emails (Resend rate limit)
        if (i < users.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (err: any) {
        failCount++
        console.error(`❌ [weekly-summary] Error for ${user.email}:`, err.message)
        results.push({ email: user.email, success: false, trades: user.trade_count })
      }
    }

    return NextResponse.json({
      message: `Weekly summary: sent ${sentCount} emails, ${failCount} failed`,
      sent: sentCount,
      failed: failCount,
      total: users.length,
      week: formatWeekLabel(weekStart, new Date(weekEnd.getTime() - 1)),
      results,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (error: any) {
    console.error('[cron/weekly-summary] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
