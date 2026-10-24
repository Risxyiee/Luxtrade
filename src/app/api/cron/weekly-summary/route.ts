import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, getWeeklySummaryHtml } from '@/lib/email'
import { getCronAdmin, fetchAllRows, isMissingTableError, chunk } from '@/lib/cron-supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

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
 * Cron: runs every Monday at 10:00 AM WIB (03:00 UTC) via Cloudflare Workers cron trigger
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
  top_symbols: { symbol: string; count: number }[]
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

/**
 * Weekly stats via Supabase REST (Prisma cannot run on CF Workers —
 * its engine calls fs.readdir which unenv throws on).
 * Trades are aggregated in JS instead of SQL GROUP BY.
 */
async function getWeeklyStats(admin: SupabaseClient, weekStart: Date, weekEnd: Date, targetUid?: string): Promise<WeeklyStats[]> {
  // 1. Fetch all trades closed within the week window (paginated)
  const tradeRows = await fetchAllRows<any>((from, to) =>
    admin.from('trades')
      .select('user_id, profit_loss, symbol')
      .gte('close_time', weekStart.toISOString())
      .lt('close_time', weekEnd.toISOString())
      .range(from, to)
  )
  if (tradeRows.length === 0) return []

  // 2. Aggregate per user in JS (replaces SQL GROUP BY + FILTER)
  const agg = new Map<string, {
    trade_count: number; total_pnl: number; win_count: number; loss_count: number
    best_trade: number; worst_trade: number; symbols: Map<string, number>
  }>()
  for (const t of tradeRows) {
    const uid = t.user_id
    if (!uid) continue
    if (targetUid && uid !== targetUid) continue
    let a = agg.get(uid)
    if (!a) {
      a = { trade_count: 0, total_pnl: 0, win_count: 0, loss_count: 0, best_trade: 0, worst_trade: 0, symbols: new Map() }
      agg.set(uid, a)
    }
    const pnl = Number(t.profit_loss || 0)
    a.trade_count++
    a.total_pnl += pnl
    if (pnl > 0) { a.win_count++; a.best_trade = Math.max(a.best_trade, pnl) }
    else { a.loss_count++; a.worst_trade = Math.min(a.worst_trade, pnl) }
    const sym = String(t.symbol || '').toUpperCase()
    if (sym) a.symbols.set(sym, (a.symbols.get(sym) || 0) + 1)
  }
  if (agg.size === 0) return []

  // 3. Fetch profiles for these users (chunked)
  const profileRows: any[] = []
  for (const c of chunk([...agg.keys()], 100)) {
    const rows = await fetchAllRows<any>((from, to) =>
      admin.from('profiles').select('id, email, full_name, streak_count').in('id', c).range(from, to)
    )
    profileRows.push(...rows)
  }
  const profileMap = new Map(profileRows.map((p: any) => [p.id, p]))

  // 4. Unsubscribe + dedup from weekly_summary_emails (log table may be missing — degrade gracefully)
  const sentWeek = new Set<string>()
  const unsubAll = new Set<string>()
  try {
    const weekRows = await fetchAllRows<any>((from, to) =>
      admin.from('weekly_summary_emails')
        .select('user_id, status')
        .gte('week_start', weekStart.toISOString())
        .lt('week_start', weekEnd.toISOString())
        .range(from, to)
    )
    weekRows.forEach((r: any) => {
      if (r.status === 'unsubscribed') unsubAll.add(r.user_id)
      else sentWeek.add(r.user_id)
    })
  } catch (err: any) {
    if (!isMissingTableError(err)) console.warn('[weekly-summary] dedup query failed:', err.message)
  }
  try {
    const unsubRows = await fetchAllRows<any>((from, to) =>
      admin.from('weekly_summary_emails').select('user_id').eq('status', 'unsubscribed').range(from, to)
    )
    unsubRows.forEach((r: any) => unsubAll.add(r.user_id))
  } catch (err: any) {
    if (!isMissingTableError(err)) console.warn('[weekly-summary] unsub query failed:', err.message)
  }

  // 5. Build result rows ordered by trade_count desc
  const result: WeeklyStats[] = []
  for (const [uid, a] of agg) {
    const p = profileMap.get(uid)
    if (!p?.email) continue
    if (sentWeek.has(uid) || unsubAll.has(uid)) continue
    result.push({
      user_id: uid,
      email: p.email,
      full_name: p.full_name || p.email?.split('@')[0] || 'Trader',
      trade_count: a.trade_count,
      total_pnl: Number(a.total_pnl.toFixed(2)),
      win_count: a.win_count,
      loss_count: a.loss_count,
      best_trade: a.best_trade,
      worst_trade: a.worst_trade,
      streak_count: p.streak_count || 0,
      top_symbols: [...a.symbols.entries()]
        .map(([symbol, count]) => ({ symbol, count }))
        .sort((x, y) => y.count - x.count)
        .slice(0, 5),
    })
  }
  result.sort((a, b) => b.trade_count - a.trade_count)
  return result
}

/**
 * Log the sent email — only uses columns guaranteed by the Prisma schema
 * (id, user_id, week_start, sent_at, status). Plain insert: dedup relies on
 * the pre-check in getWeeklyStats; duplicate inserts are tolerated.
 */
async function logSentEmail(stats: WeeklyStats, weekStart: Date, weekEnd: Date, success: boolean): Promise<void> {
  const admin = await getCronAdmin()
  if (!admin) return
  try {
    const { error } = await admin.from('weekly_summary_emails').insert({
      user_id: stats.user_id,
      week_start: weekStart.toISOString(),
      sent_at: new Date().toISOString(),
      status: success ? 'sent' : 'failed',
    })
    if (error && !isMissingTableError(error)) {
      console.warn(`[weekly-summary] Failed to log email for ${stats.user_id}:`, error.message)
    }
  } catch (err: any) {
    if (!isMissingTableError(err)) {
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

  const subject = `📊 Weekly Report: ${stats.trade_count} trades ${stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })} PnL — LuxTradee`

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

    // Get users with weekly stats (Supabase admin — Prisma cannot run on CF Workers)
    const admin = await getCronAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Database not available', sent: 0 })
    }
    const users = await getWeeklyStats(admin, weekStart, weekEnd, targetUid)

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
        const success = await sendWeeklyEmail(user, user.top_symbols || [], weekStart, weekEnd)
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
