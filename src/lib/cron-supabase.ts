import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClientAsync } from '@/lib/supabase/admin'

/**
 * Shared helpers for cron API routes on Cloudflare Workers.
 *
 * WHY THIS EXISTS:
 * Prisma cannot run on CF Workers — its query engine calls fs.readdir/fs.existsSync
 * to locate the Rust engine binary, which unenv shims throw on:
 *   "[unenv] fs.readdir is not implemented yet!"
 *
 * All cron routes must therefore use the Supabase admin client (pure HTTPS REST),
 * exactly like src/app/api/cron/auto-sync-trades (which works fine on Workers).
 */

/**
 * Get a Supabase admin client for cron routes.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL
 * are not resolvable (e.g. local dev without .env, or build time).
 */
export async function getCronAdmin(): Promise<SupabaseClient | null> {
  try {
    return await createAdminClientAsync()
  } catch (err: any) {
    console.warn('[cron-supabase] Failed to create admin client:', err?.message)
    return null
  }
}

/**
 * Detect "table/function does not exist" errors from PostgREST.
 * Cron log tables (daily_reminder_logs, re_engagement_emails, weekly_summary_emails)
 * may not exist yet in production — routes must degrade gracefully instead of crashing.
 */
export function isMissingTableError(err: any): boolean {
  if (!err) return false
  const code = err.code || err.error_code || ''
  const msg = String(err.message || err.details || '')
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    msg.includes('does not exist') ||
    msg.includes('Could not find the table') ||
    msg.includes('relation') && msg.includes('does not exist')
  )
}

/**
 * Fetch ALL rows from a paginated Supabase query (PostgREST caps at 1000 rows/request).
 *
 * Usage:
 *   const rows = await fetchAllRows((from, to) =>
 *     admin.from('trades').select('user_id').gte('close_time', cutoff).range(from, to)
 *   )
 *
 * Safety cap: 200 pages = 200k rows max, prevents infinite loops.
 */
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => { then: Function; catch: Function } | PromiseLike<any>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; page < 200; page++) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data, error } = await build(from, to)
    if (error) throw error
    if (data) all.push(...data)
    if (!data || data.length < pageSize) break
  }
  return all
}

/** Split an array into fixed-size chunks (for `.in()` filters — URL length limits). */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * SQL to create the cron log tables in Supabase (SQL Editor).
 * Only needed if these tables don't exist yet — routes degrade gracefully without them,
 * but email dedup + unsubscribe persistence REQUIRE them.
 */
export const CRON_LOG_TABLES_SQL = `
-- Daily reminder email log (dedup per day + unsubscribe flag)
CREATE TABLE IF NOT EXISTS public.daily_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT,
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_reminder_logs_user_date_uniq UNIQUE (user_id, sent_date)
);
ALTER TABLE public.daily_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Re-engagement email log (one email per user ever)
CREATE TABLE IF NOT EXISTS public.re_engagement_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  email_type TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.re_engagement_emails ENABLE ROW LEVEL SECURITY;
`
