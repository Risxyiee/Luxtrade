import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import {
  getReEngagementNoTradeHtml,
  getReEngagementHasTradeHtml,
} from '@/lib/email'
import { getCronAdmin, fetchAllRows, isMissingTableError, chunk } from '@/lib/cron-supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

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
 * Cron: runs daily at 10:00 AM WIB (03:00 UTC) via Cloudflare Workers cron trigger
 */
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

/**
 * Target users via Supabase (Prisma cannot run on CF Workers — its engine
 * calls fs.readdir which unenv throws on).
 *
 * auth.users is NOT exposed via PostgREST — use the admin Auth API listUsers()
 * pagination instead, then filter in JS. Trade counts come from public.trades.
 */
async function getTargetUsers(admin: SupabaseClient, force: boolean): Promise<TargetUser[]> {
  const now = Date.now()
  const windowStart = new Date(now - 48 * 3600 * 1000)
  const windowEnd = new Date(now - 24 * 3600 * 1000)

  // 1. List all auth users (paginated, 200/page)
  const candidates: TargetUser[] = []
  const perPage = 200
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    for (const u of users) {
      if (!u.email || !(u as any).email_confirmed_at) continue
      const createdAt = new Date(u.created_at || 0)
      if (!force) {
        // Signed up 24-48h ago AND never came back after signup day
        if (createdAt < windowStart || createdAt > windowEnd) continue
        const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null
        if (lastSignIn && lastSignIn.toISOString().slice(0, 10) !== createdAt.toISOString().slice(0, 10)) continue
      }
      candidates.push({
        user_id: u.id,
        email: u.email,
        full_name: (u.user_metadata as any)?.full_name || u.email?.split('@')[0] || 'Trader',
        created_at: u.created_at || '',
        last_sign_in_at: u.last_sign_in_at || null,
        trade_count: 0,
        email_type: 'no_trade',
      })
    }
    if (users.length < perPage) break
  }
  if (candidates.length === 0) return []

  // 2. Skip users who already received a re-engagement email (log table may be missing — degrade)
  const emailedSet = new Set<string>()
  try {
    const emailedRows = await fetchAllRows<any>((from, to) =>
      admin.from('re_engagement_emails').select('user_id').range(from, to)
    )
    emailedRows.forEach((r: any) => emailedSet.add(r.user_id))
  } catch (err: any) {
    if (!isMissingTableError(err)) console.warn('[re-engage] log query failed:', err.message)
  }
  const filtered = candidates.filter(c => !emailedSet.has(c.user_id))
  if (filtered.length === 0) return []

  // 3. Count trades per candidate (chunked)
  const tradeCounts = new Map<string, number>()
  for (const c of chunk(filtered.map(f => f.user_id), 100)) {
    const rows = await fetchAllRows<any>((from, to) =>
      admin.from('trades').select('user_id').in('user_id', c).range(from, to)
    )
    rows.forEach((r: any) => tradeCounts.set(r.user_id, (tradeCounts.get(r.user_id) || 0) + 1))
  }

  return filtered.map(c => ({
    ...c,
    trade_count: tradeCounts.get(c.user_id) || 0,
    email_type: (tradeCounts.get(c.user_id) || 0) > 0 ? ('has_trade' as const) : ('no_trade' as const),
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
    subject = `Trade pertamamu udah tersimpan! 📊 — Yuk lanjutin di LuxTradee`
  } else {
    html = getReEngagementNoTradeHtml(name, ctaUrl, unsubUrl)
    subject = `Yuk Coba LuxTradee! 👑 — Upload 1 trade, dapat 1 hari PRO gratis`
  }

  const result = await sendEmail({ to: user.email, subject, html })
  return result.success
}

async function logSentEmail(user: TargetUser, success: boolean): Promise<void> {
  const admin = await getCronAdmin()
  if (!admin) return
  try {
    const { error } = await admin.from('re_engagement_emails').upsert(
      {
        user_id: user.user_id,
        email: user.email,
        email_type: user.email_type,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'user_id', ignoreDuplicates: false }
    )
    if (error && !isMissingTableError(error)) {
      console.warn(`[re-engage] Failed to log email for ${user.user_id}:`, error.message)
    }
  } catch (err: any) {
    if (!isMissingTableError(err)) {
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

  // Auth check (getEnvVar reads CF bindings/secrets reliably on Workers)
  // NOTE: ?force=true no longer bypasses auth.
  // P0 hardening: FAIL-CLOSED — tanpa CRON_SECRET, DITOLAK di produksi (dulu: allow).
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  const expectedSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!expectedSecret) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'CRON_SECRET not configured — endpoint disabled (fail-closed)' }, { status: 403 })
    }
  } else if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = await getCronAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Database not available', sent: 0 })
    }
    let users = await getTargetUsers(admin, force)

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
