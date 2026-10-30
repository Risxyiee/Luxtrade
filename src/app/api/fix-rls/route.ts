import { NextRequest, NextResponse } from 'next/server'
import { autoFixRLS } from '@/lib/auto-fix-rls'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * RLS Health Check endpoint — ADMIN ONLY.
 *
 * GET /api/fix-rls  — butuh sesi admin (dipakai tombol "Fix RLS" di /dashboard/admin)
 * POST /api/fix-rls — sama
 *
 * SECURITY (P0 hardening): dulu endpoint ini TERBUKA untuk publik
 * ("No auth required — visit in browser!") dan membocorkan daftar tabel +
 * SQL GRANT. Sekarang wajib admin.
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const result = await autoFixRLS()

    // If there are failed tables, include fix SQL
    const failedTables = result.checks.filter(c => !c.accessible)
    if (failedTables.length > 0) {
      const fixSql = generateFixSql(failedTables.map(t => t.table))
      return NextResponse.json({ ...result, fixSql, instructions: 'Copy the fixSql and run it in Supabase SQL Editor (Dashboard → SQL Editor)' })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, message: 'RLS check failed', detail: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
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
