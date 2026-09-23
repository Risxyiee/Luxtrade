import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { db } from '@/lib/db'

/**
 * Fix RLS and permissions for user_submissions and mission_progress tables.
 * Run: POST /api/fix-rls  (Admin only)
 */
export async function POST(request: NextRequest) {
  const results: { step: string; status: string; detail?: string }[] = []

  try {
    const authResult = await getAuthenticatedUser(request)
    if (!authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const profile = await db.profile.findUnique({ where: { id: authResult.user.id }, select: { role: true } })
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    // GRANT permissions
    const grants = [
      `GRANT ALL ON TABLE public.user_submissions TO authenticated;`,
      `GRANT ALL ON TABLE public.user_submissions TO service_role;`,
      `GRANT ALL ON TABLE public.mission_progress TO authenticated;`,
      `GRANT ALL ON TABLE public.mission_progress TO service_role;`,
    ]

    for (const sql of grants) {
      const tableName = sql.includes('user_submissions') ? 'user_submissions' : 'mission_progress'
      const role = sql.includes('authenticated') ? 'authenticated' : 'service_role'
      try {
        await db.$executeRawUnsafe(sql)
        results.push({ step: `GRANT ${role} ON ${tableName}`, status: 'ok' })
      } catch (err: any) {
        results.push({ step: `GRANT ${role} ON ${tableName}`, status: 'error', detail: err.message?.slice(0, 200) })
      }
    }

    // Enable RLS
    for (const table of ['user_submissions', 'mission_progress']) {
      try {
        await db.$executeRawUnsafe(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)
        results.push({ step: `ENABLE RLS ON ${table}`, status: 'ok' })
      } catch (err: any) {
        results.push({ step: `ENABLE RLS ON ${table}`, status: 'error', detail: err.message?.slice(0, 200) })
      }
    }

    // Drop wrong policy (copy-paste bug)
    try {
      await db.$executeRawUnsafe(`DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.user_submissions;`)
      results.push({ step: 'DROP wrong policy', status: 'ok' })
    } catch (err: any) {
      results.push({ step: 'DROP wrong policy', status: 'error', detail: err.message?.slice(0, 200) })
    }

    // Create proper RLS policies
    const policies = [
      `CREATE POLICY "Users can view own submissions" ON public.user_submissions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can insert own submissions" ON public.user_submissions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can update own submissions" ON public.user_submissions FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can delete own submissions2" ON public.user_submissions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can view own mission progress" ON public.mission_progress FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can insert own mission progress" ON public.mission_progress FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can update own mission progress" ON public.mission_progress FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id);`,
      `CREATE POLICY "Users can delete own mission progress2" ON public.mission_progress FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);`,
    ]

    for (const sql of policies) {
      const match = sql.match(/CREATE POLICY "([^"]+)"/)
      const policyName = match ? match[1] : 'unknown'
      try {
        await db.$executeRawUnsafe(sql)
        results.push({ step: `CREATE POLICY ${policyName}`, status: 'ok' })
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          results.push({ step: `CREATE POLICY ${policyName}`, status: 'already_exists' })
        } else {
          results.push({ step: `CREATE POLICY ${policyName}`, status: 'error', detail: err.message?.slice(0, 200) })
        }
      }
    }

    // Missing DELETE policy for user_subscriptions
    try {
      await db.$executeRawUnsafe(
        `CREATE POLICY "Users can delete own subscriptions" ON public.user_subscriptions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);`
      )
      results.push({ step: 'CREATE POLICY delete subscriptions', status: 'ok' })
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        results.push({ step: 'CREATE POLICY delete subscriptions', status: 'already_exists' })
      } else {
        results.push({ step: 'CREATE POLICY delete subscriptions', status: 'error', detail: err.message?.slice(0, 200) })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'RLS fix failed', detail: err.message, results }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
