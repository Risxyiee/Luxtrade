import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import {
  getReEngagementNoTradeHtml,
  getReEngagementHasTradeHtml,
} from '@/lib/email'

/**
 * GET/POST /api/cron/re-engage
 * Cron job: sends re-engagement email to users who signed up 24-48h ago
 * but never came back (last_sign_in_at = signup day).
 *
 * TWO email variants:
 *   - no_trade: user has 0 trades → "upload 1 trade, get 1 day PRO free"
 *   - has_trade: user has ≥1 trades → "your first trade is saved, add more"
 *
 * Only sends ONCE per user (tracked in re_engagement_emails table).
 * Supports ?dry=true for preview without sending.
 *
 * Vercel Cron: runs daily at 10:00 AM WIB (03:00 UTC)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

interface TargetUser {
  user_id: string
  email: string
  full_name: string | null
  created_at: string
  last_sign_in_at: string | null
  trade_count: number
  email_type: 'no_trade' | 'has_trade'
}

async function getTargetUsers(): Promise<TargetUser[]> {
  // Users who signed up 24-48 hours ago AND never came back after signup day
  // AND haven't received a re-engagement email yet
  const rows: any[] = await db.$queryRawUnsafe(`
    SELECT
      u.id AS user_id,
      u.email,
      u.raw_user_meta_data->>'full_name' AS full_name,
      u.created_at,
      u.last_sign_in_at,
      COALESCE(t.trade_count, 0)::int AS trade_count
    FROM auth.users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS trade_count
      FROM public.trades
      GROUP BY user_id
    ) t ON t.user_id = u.id::text
    WHERE u.created_at BETWEEN NOW() - interval '48 hours' AND NOW() - interval '24 hours'
      AND (
        u.last_sign_in_at IS NULL
        OR date(u.last_sign_in_at) = date(u.created_at)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.re_engagement_emails re
        WHERE re.user_id = u.id::text
      )
      AND u.email IS NOT NULL
      AND u.confirmed_at IS NOT NULL
    ORDER BY u.created_at ASC;
  `)

  return rows.map((r: any) => ({
    user_id: r.user_id,
    email: r.email,
    full_name: r.full_name || r.email?.split('@')[0] || 'Trader',
    created_at: r.created_at,
    last_sign_in_at: r.last_sign_in_at,
    trade_count: r.trade_count,
    email_type: r.trade_count > 0 ? 'has_trade' : 'no_trade',
  }))
}

async function sendReEngagementEmail(user: TargetUser): Promise<boolean> {
  const name = user.full_name || 'Trader'
  const ctaUrl = `${SITE_URL}/dashboard`
  const unsubUrl = `${SITE_URL}/api/cron/re-engage/unsubscribe?uid=${user.user_id}`

  let html: string
  let subject: string

  if (user.email_type === 'has_trade') {
    html = getReEngagementHasTradeHtml(name, user.trade_count, ctaUrl, unsubUrl)
    subject = `Trade pertamamu udah tersimpan! 📊 — Yuk lanjutin di LuxTrade`
  } else {
    html = getReEngagementNoTradeHtml(name, ctaUrl, unsubUrl)
    subject = `Yuk Coba LuxTrade! 👑 — Upload 1 trade, dapat 1 hari PRO gratis`
  }

  const result = await sendEmail({ to: user.email, subject, html })
  return result.success
}

async function logSentEmail(user: TargetUser, success: boolean): Promise<void> {
  try {
    await db.$executeRawUnsafe(`
      INSERT INTO public.re_engagement_emails (user_id, email, email_type, sent_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO NOTHING;
    `, user.user_id, user.email, user.email_type)
  } catch (err: any) {
    // Unique constraint violation is expected (race condition guard)
    if (!err.code || err.code !== '23505') {
      console.warn(`[re-engage] Failed to log email for ${user.user_id}:`, err.message)
    }
  }
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

  // Simple auth check: require CRON_SECRET header (set in Vercel env)
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!force && process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not available', sent: 0 })
  }

  try {
    let users = await getTargetUsers()

    // ?force=true: ignore the 24-48h window, get ALL unengaged users
    if (force) {
      const allRows: any[] = await db.$queryRawUnsafe(`
        SELECT
          u.id AS user_id,
          u.email,
          u.raw_user_meta_data->>'full_name' AS full_name,
          u.created_at,
          u.last_sign_in_at,
          COALESCE(t.trade_count, 0)::int AS trade_count
        FROM auth.users u
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS trade_count
          FROM public.trades
          GROUP BY user_id
        ) t ON t.user_id = u.id::text
        WHERE NOT EXISTS (
          SELECT 1 FROM public.re_engagement_emails re
          WHERE re.user_id = u.id::text
        )
          AND u.email IS NOT NULL
          AND u.confirmed_at IS NOT NULL
        ORDER BY u.created_at ASC;
      `)

      users = allRows.map((r: any) => ({
        user_id: r.user_id,
        email: r.email,
        full_name: r.full_name || r.email?.split('@')[0] || 'Trader',
        created_at: r.created_at,
        last_sign_in_at: r.last_sign_in_at,
        trade_count: r.trade_count,
        email_type: r.trade_count > 0 ? 'has_trade' : 'no_trade',
      }))
    }

    if (users.length === 0) {
      return NextResponse.json({
        message: 'No users to re-engage',
        sent: 0,
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Dry run: just report, don't send
    if (dry) {
      return NextResponse.json({
        message: `DRY RUN — would send ${users.length} emails`,
        sent: 0,
        users: users.map(u => ({
          user_id: u.user_id,
          email: u.email,
          name: u.full_name,
          type: u.email_type,
          trade_count: u.trade_count,
        })),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Send emails with 500ms delay between each (Resend rate limit)
    let sentCount = 0
    let failCount = 0
    const results: { email: string; success: boolean; type: string }[] = []

    for (const user of users) {
      try {
        const success = await sendReEngagementEmail(user)
        await logSentEmail(user, success)

        if (success) {
          sentCount++
          console.log(`✅ [re-engage] Sent ${user.email_type} to user=${user.user_id} (${user.email})`)
        } else {
          failCount++
          console.warn(`⚠️ [re-engage] Failed to send to user=${user.user_id} (${user.email})`)
        }

        results.push({ email: user.email, success, type: user.email_type })

        // Delay to avoid Resend rate limit (1 req/sec free tier)
        if (users.indexOf(user) < users.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (err: any) {
        failCount++
        console.error(`❌ [re-engage] Error for user=${user.user_id}:`, err.message)
        results.push({ email: user.email, success: false, type: user.email_type })
      }
    }

    return NextResponse.json({
      message: `Re-engagement: sent ${sentCount} emails, ${failCount} failed`,
      sent: sentCount,
      failed: failCount,
      total: users.length,
      results,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (error: any) {
    console.error('[cron/re-engage] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
