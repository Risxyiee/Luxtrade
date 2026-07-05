import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db } from '@/lib/db'

/**
 * One-time database fix endpoint.
 * Run: GET /api/setup-db
 * 
 * Adds ALL missing columns, sets DEFAULTs, backfills NULLs.
 * Safe to run multiple times (IF NOT EXISTS everywhere).
 */
export async function GET(request: NextRequest) {
  const results: { step: string; status: string; detail?: string }[] = []

  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const profile = await db.profile.findUnique({ where: { id: authUser.id }, select: { role: true } })
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    // Step 1: Add columns
    const columns = [
      `email TEXT`,
      `streak_count INTEGER DEFAULT 0`,
      `last_login_at TIMESTAMPTZ`,
      `best_streak INTEGER DEFAULT 0`,
      // achievements skipped — Supabase has it as jsonb
      `plan TEXT DEFAULT 'FREE'`,
      `pro_expiry TIMESTAMPTZ`,
      `role TEXT DEFAULT 'USER'`,
      `full_name TEXT`,
      `is_pro BOOLEAN DEFAULT false`,
      `subscription_until TIMESTAMPTZ`,
      `email_verified BOOLEAN DEFAULT false`,
      `email_verify_token TEXT`,
      `email_verify_exp_at TIMESTAMPTZ`,
      `created_at TIMESTAMPTZ DEFAULT now()`,
      `updated_at TIMESTAMPTZ DEFAULT now()`,
      `device_id TEXT`,
      `my_referral_code TEXT`,
      `referred_by_code TEXT`,
      `has_ever_been_pro BOOLEAN DEFAULT false`,
      `commission_paid BOOLEAN DEFAULT false`,
    ]

    for (const colDef of columns) {
      const colName = colDef.split(' ')[0]
      try {
        await db.$executeRawUnsafe(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ${colDef};`)
        results.push({ step: `ADD ${colName}`, status: 'ok' })
      } catch (err: any) {
        results.push({ step: `ADD ${colName}`, status: 'error', detail: err.message?.slice(0, 100) })
      }
    }

    // Step 2: Set DEFAULT on timestamp columns
    try {
      await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN created_at SET DEFAULT now();`)
      results.push({ step: 'DEFAULT created_at', status: 'ok' })
    } catch (err: any) {
      results.push({ step: 'DEFAULT created_at', status: 'error', detail: err.message?.slice(0, 100) })
    }
    try {
      await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN updated_at SET DEFAULT now();`)
      results.push({ step: 'DEFAULT updated_at', status: 'ok' })
    } catch (err: any) {
      results.push({ step: 'DEFAULT updated_at', status: 'error', detail: err.message?.slice(0, 100) })
    }

    // Step 2b: DROP NOT NULL constraints on ALL columns (Supabase defaults may have NOT NULL)
    const dropNotNullCols = [
      'email', 'streak_count', 'last_login_at', 'best_streak', 'achievements',
      'plan', 'pro_expiry', 'role', 'full_name', 'is_pro', 'subscription_until',
      'email_verified', 'email_verify_token', 'email_verify_exp_at',
      'created_at', 'updated_at', 'device_id', 'my_referral_code', 'referred_by_code',
      'has_ever_been_pro', 'commission_paid',
    ]
    for (const col of dropNotNullCols) {
      try {
        await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN ${col} DROP NOT NULL;`)
        results.push({ step: `DROP NOT NULL ${col}`, status: 'ok' })
      } catch (err: any) {
        results.push({ step: `DROP NOT NULL ${col}`, status: 'error', detail: err.message?.slice(0, 100) })
      }
    }

    // Step 3: Backfill NULLs
    try {
      const r1 = await db.$executeRawUnsafe(`UPDATE profiles SET created_at = now() WHERE created_at IS NULL;`)
      results.push({ step: 'BACKFILL created_at', status: 'ok' })
    } catch (err: any) {
      results.push({ step: 'BACKFILL created_at', status: 'error', detail: err.message?.slice(0, 100) })
    }
    try {
      await db.$executeRawUnsafe(`UPDATE profiles SET updated_at = now() WHERE updated_at IS NULL;`)
      results.push({ step: 'BACKFILL updated_at', status: 'ok' })
    } catch (err: any) {
      results.push({ step: 'BACKFILL updated_at', status: 'error', detail: err.message?.slice(0, 100) })
    }

    // Step 4: Create indexes
    try {
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS profiles_my_referral_code_key ON profiles(my_referral_code) WHERE my_referral_code IS NOT NULL;`)
      results.push({ step: 'INDEX my_referral_code', status: 'ok' })
    } catch (err: any) {
      results.push({ step: 'INDEX my_referral_code', status: 'error', detail: err.message?.slice(0, 100) })
    }
    try {
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_verify_token_key ON profiles(email_verify_token) WHERE email_verify_token IS NOT NULL;`)
      results.push({ step: 'INDEX email_verify_token', status: 'ok' })
    } catch (err: any) {
      results.push({ step: 'INDEX email_verify_token', status: 'error', detail: err.message?.slice(0, 100) })
    }

    // Step 5: Verify Prisma works
    let prismaTest = false
    try {
      await db.$queryRaw`SELECT 1 as ok`
      prismaTest = true
    } catch (err: any) {
      results.push({ step: 'PRISMA TEST', status: 'error', detail: err.message?.slice(0, 100) })
    }

    return NextResponse.json({
      success: true,
      prismaConnected: prismaTest,
      results,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
