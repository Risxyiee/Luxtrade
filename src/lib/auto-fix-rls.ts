/**
 * Auto-fix RLS and permissions for tables that may lack proper policies.
 * This runs automatically on first landing-stats API call (fire-and-forget).
 *
 * Strategy: Use the Supabase admin client to verify table access by attempting
 * a lightweight query. If it fails with permission denied, the fix needs to be
 * applied via Supabase SQL editor or migration (we cannot execute DDL via the
 * JS client — Supabase doesn't provide an exec_sql RPC).
 *
 * This module serves as a HEALTH CHECK that logs which tables need RLS fixes,
 * rather than attempting DDL operations that require direct PostgreSQL access.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

let hasRun = false

export interface RlsCheckResult {
  success: boolean
  checks: { table: string; accessible: boolean; detail?: string }[]
  message: string
}

/**
 * Check if critical tables are accessible via the admin client.
 * This is a read-only health check — it does NOT modify the database.
 */
export async function autoFixRLS(): Promise<RlsCheckResult> {
  if (hasRun) {
    return { success: true, checks: [], message: 'Already checked' }
  }

  hasRun = true

  const checks: RlsCheckResult['checks'] = []

  const adminClient = getSupabaseAdmin()
  if (!adminClient) {
    const result: RlsCheckResult = {
      success: false,
      checks: [],
      message: 'SUPABASE_SERVICE_ROLE_KEY not configured — admin client unavailable. Set it as a Cloudflare secret: wrangler secret put SUPABASE_SERVICE_ROLE_KEY'
    }
    console.error('[auto-fix-rls]', result.message)
    return result
  }

  // Tables that need admin access (used by admin API routes)
  const tablesToCheck = [
    { table: 'testimonials', query: () => adminClient.from('testimonials').select('id', { count: 'exact', head: true }) },
    { table: 'user_submissions', query: () => adminClient.from('user_submissions').select('id', { count: 'exact', head: true }) },
    { table: 'mission_progress', query: () => adminClient.from('mission_progress').select('id', { count: 'exact', head: true }) },
    { table: 'profiles', query: () => adminClient.from('profiles').select('id', { count: 'exact', head: true }) },
    { table: 'trades', query: () => adminClient.from('trades').select('id', { count: 'exact', head: true }) },
  ]

  for (const { table, query } of tablesToCheck) {
    try {
      const { error } = await query()
      if (error) {
        checks.push({ table, accessible: false, detail: error.message?.slice(0, 200) })
      } else {
        checks.push({ table, accessible: true })
      }
    } catch (err: any) {
      checks.push({ table, accessible: false, detail: err.message?.slice(0, 200) })
    }
  }

  const failedTables = checks.filter(c => !c.accessible)
  const okTables = checks.filter(c => c.accessible)

  if (failedTables.length > 0) {
    const result: RlsCheckResult = {
      success: false,
      checks,
      message: `RLS check: ${okTables.length} tables OK, ${failedTables.length} tables need permission fix: ${failedTables.map(t => t.table).join(', ')}. Apply the migration in supabase/migrations/20260728_enable_rls_all_tables.sql via Supabase SQL Editor.`
    }
    console.warn('[auto-fix-rls]', result.message)
    return result
  }

  const result: RlsCheckResult = {
    success: true,
    checks,
    message: `All ${checks.length} tables accessible via admin client`
  }
  console.log('[auto-fix-rls]', result.message)
  return result
}
