/**
 * Auto-fix RLS and GRANT permissions for user_submissions and mission_progress tables.
 * This runs automatically on first server startup so no manual POST /api/fix-rls is needed.
 *
 * Uses Supabase admin client (service_role) which bypasses RLS.
 */

import { createAdminClient } from '@/lib/supabase/admin'

let hasRun = false
let lastResult: { success: boolean; results: { step: string; status: string; detail?: string }[] } | null = null

export async function autoFixRLS(): Promise<typeof lastResult> {
  if (hasRun) return lastResult

  hasRun = true

  const results: { step: string; status: string; detail?: string }[] = []

  try {
    const adminClient = createAdminClient()

    // GRANT permissions using raw SQL via Supabase rpc
    const grants = [
      { sql: 'GRANT ALL ON TABLE public.user_submission TO authenticated;', table: 'user_submission', role: 'authenticated' },
      { sql: 'GRANT ALL ON TABLE public.user_submission TO service_role;', table: 'user_submission', role: 'service_role' },
      { sql: 'GRANT ALL ON TABLE public.mission_progress TO authenticated;', table: 'mission_progress', role: 'authenticated' },
      { sql: 'GRANT ALL ON TABLE public.mission_progress TO service_role;', table: 'mission_progress', role: 'service_role' },
    ]

    for (const grant of grants) {
      try {
        const { error } = await adminClient.rpc('exec_sql', { query: grant.sql })
        if (error && !error.message.includes('does not exist')) {
          results.push({ step: `GRANT ${grant.role} ON ${grant.table}`, status: 'error', detail: error.message?.slice(0, 200) })
        } else {
          results.push({ step: `GRANT ${grant.role} ON ${grant.table}`, status: 'ok' })
        }
      } catch (err: any) {
        results.push({ step: `GRANT ${grant.role} ON ${grant.table}`, status: 'error', detail: err.message?.slice(0, 200) })
      }
    }

    // Enable RLS
    for (const table of ['user_submission', 'mission_progress']) {
      try {
        const { error } = await adminClient.rpc('exec_sql', { query: `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;` })
        if (error) {
          results.push({ step: `ENABLE RLS ON ${table}`, status: 'error', detail: error.message?.slice(0, 200) })
        } else {
          results.push({ step: `ENABLE RLS ON ${table}`, status: 'ok' })
        }
      } catch (err: any) {
        results.push({ step: `ENABLE RLS ON ${table}`, status: 'error', detail: err.message?.slice(0, 200) })
      }
    }

    // Drop wrong policy on user_submissions (copy-paste bug)
    try {
      await adminClient.rpc('exec_sql', { query: 'DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.user_submissions;' })
      results.push({ step: 'DROP wrong policy on user_submissions', status: 'ok' })
    } catch (err: any) {
      results.push({ step: 'DROP wrong policy on user_submissions', status: 'error', detail: err.message?.slice(0, 200) })
    }

    // Create RLS policies for user_submissions
    const userSubmissionPolicies = [
      `CREATE POLICY "Users can view own submissions" ON public.user_submissions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can insert own submissions" ON public.user_submissions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can update own submissions" ON public.user_submissions FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can delete own submissions2" ON public.user_submissions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);`,
    ]

    for (const sql of userSubmissionPolicies) {
      const match = sql.match(/CREATE POLICY "([^"]+)"/)
      const name = match ? match[1] : 'unknown'
      try {
        await adminClient.rpc('exec_sql', { query: sql })
        results.push({ step: `POLICY ${name}`, status: 'ok' })
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          results.push({ step: `POLICY ${name}`, status: 'already_exists' })
        } else {
          results.push({ step: `POLICY ${name}`, status: 'error', detail: err.message?.slice(0, 200) })
        }
      }
    }

    // Create RLS policies for mission_progress
    const missionProgressPolicies = [
      `CREATE POLICY "Users can view own mission progress" ON public.mission_progress FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can insert own mission progress" ON public.mission_progress FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can update own mission progress" ON public.mission_progress FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can delete own mission progress2" ON public.mission_progress FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);`,
    ]

    for (const sql of missionProgressPolicies) {
      const match = sql.match(/CREATE POLICY "([^"]+)"/)
      const name = match ? match[1] : 'unknown'
      try {
        await adminClient.rpc('exec_sql', { query: sql })
        results.push({ step: `POLICY ${name}`, status: 'ok' })
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          results.push({ step: `POLICY ${name}`, status: 'already_exists' })
        } else {
          results.push({ step: `POLICY ${name}`, status: 'error', detail: err.message?.slice(0, 200) })
        }
      }
    }

    // Fix DELETE policy on user_subscriptions (was wrongly placed on user_submissions)
    try {
      await adminClient.rpc('exec_sql', {
        query: `CREATE POLICY "Users can delete own subscriptions" ON public.user_subscriptions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);`
      })
      results.push({ step: 'POLICY delete subscriptions', status: 'ok' })
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        results.push({ step: 'POLICY delete subscriptions', status: 'already_exists' })
      } else {
        results.push({ step: 'POLICY delete subscriptions', status: 'error', detail: err.message?.slice(0, 200) })
      }
    }

    lastResult = { success: true, results }
    console.log('[auto-fix-rls] RLS fix completed:', results.filter(r => r.status === 'ok').length, 'ok,', results.filter(r => r.status === 'error').length, 'errors')
    return lastResult

  } catch (err: any) {
    lastResult = { success: false, results: [...results, { step: 'fatal', status: 'error', detail: err.message?.slice(0, 300) }] }
    console.error('[auto-fix-rls] Fatal error:', err.message)
    return lastResult
  }
}
