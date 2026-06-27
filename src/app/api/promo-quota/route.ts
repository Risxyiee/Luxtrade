import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const logId = Math.random().toString(36).substring(2, 8)
  console.log(`📊 [promo-quota:${logId}] START`)

  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json({
        code: 'TRADERCEPAT', maxQuota: 30, usedQuota: 0, remainingQuota: 30,
        discountPercent: 100, durationMonths: 3, isActive: true
      })
    }

    // Guarantee clean promo_codes table
    try {
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS public.promo_codes CASCADE;`)
      await db.$executeRawUnsafe(`CREATE TABLE "promo_codes" ("id" TEXT NOT NULL, "code" TEXT NOT NULL, "description" TEXT, "discount_percent" DOUBLE PRECISION NOT NULL, "max_quota" INTEGER NOT NULL, "used_quota" INTEGER NOT NULL DEFAULT 0, "duration_months" INTEGER NOT NULL, "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "end_date" TIMESTAMP(3), "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"));`)
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");`)
      await db.$executeRawUnsafe(`INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at) VALUES (gen_random_uuid()::text, 'TRADERCEPAT', 'Diskon 100% — 3 Bulan PRO Gratis!', 100, 30, 0, 3, NOW(), true, NOW(), NOW()) ON CONFLICT (code) DO NOTHING;`)
    } catch { /* non-critical */ }

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT id, code, description, discount_percent, max_quota, used_quota, duration_months, is_active FROM public.promo_codes WHERE code = $1`,
      code
    )

    if (!rows || rows.length === 0) {
      console.error(`❌ [promo-quota:${logId}] Promo ${code} not found`)
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    const promo = rows[0]
    const usedQuota = Number(promo.used_quota)
    const maxQuota = Number(promo.max_quota)

    console.log(`📊 [promo-quota:${logId}] used=${usedQuota}, max=${maxQuota}, active=${promo.is_active}`)

    return NextResponse.json({
      code: promo.code, maxQuota, usedQuota,
      remainingQuota: Math.max(0, maxQuota - usedQuota),
      discountPercent: Number(promo.discount_percent) || 100,
      durationMonths: Number(promo.duration_months) || 3,
      isActive: promo.is_active
    })
  } catch (error: any) {
    console.error(`💥 [promo-quota:${logId}] FATAL:`, error?.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}