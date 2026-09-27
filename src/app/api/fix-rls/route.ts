import { NextResponse } from 'next/server'
import { autoFixRLS } from '@/lib/auto-fix-rls'

/**
 * RLS Health Check endpoint.
 *
 * GET /api/fix-rls  — No auth required (visit in browser!)
 * POST /api/fix-rls — Also works
 *
 * This checks whether the admin client can access critical tables.
 * If tables are inaccessible, it returns:
 *  - Which tables need fixing
 *  - A SQL snippet you can copy-paste into Supabase SQL Editor
 *  - Whether the SUPABASE_SERVICE_ROLE_KEY is configured
 */
export async function POST() {
  try {
    const result = await autoFixRLS()

    // If there are failed tables, include fix SQL
    const failedTables = result.checks.filter(c => !c.accessible)
    if (failedTables.length > 0) {
      const fixSql = generateFixSql(failedTables.map(t => t.table))
      return NextResponse.json({ ...result, fixSql, instructions: 'Copy the fixSql and run it in Supabase SQL Editor (Dashboard → SQL Editor)' })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'RLS check failed', detail: err.message }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}

/**
 * Generate SQL to fix permissions for specific tables.
 * This must be run in Supabase SQL Editor (we can't execute DDL via JS client).
 */
function generateFixSql(tables: string[]): string {
  const lines: string[] = ['-- Fix RLS permissions for tables that need admin access', '-- Run this in Supabase SQL Editor', '']

  for (const table of tables) {
    lines.push(`-- Grant service_role access to ${table}`)
    lines.push(`GRANT ALL ON TABLE public.${table} TO service_role;`)
    lines.push(`GRANT ALL ON TABLE public.${table} TO authenticated;`)
    lines.push('')
  }

  return lines.join('\n')
}
