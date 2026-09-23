import { NextResponse } from 'next/server'
import { autoFixRLS } from '@/lib/auto-fix-rls'

/**
 * Fix RLS and permissions for user_submissions and mission_progress tables.
 * 
 * GET /api/fix-rls  — No auth required (for convenience when using mobile browser)
 * POST /api/fix-rls — Also works
 * 
 * The fix is idempotent and only runs once per server restart.
 */
export async function POST() {
  try {
    const result = await autoFixRLS()
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'RLS fix failed', detail: err.message }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
