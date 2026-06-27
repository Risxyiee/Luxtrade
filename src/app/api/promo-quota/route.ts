import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed).
 * Always reads real data from DB — no fake defaults in production.
 * 
 * SELF-HEALING: If used_quota doesn't match real subscription count,
 * fixes it automatically so the landing page always shows correct data.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const logId = Math.random().toString(36).substring(2, 8)
  console.log(`📊 [promo-quota:${logId}] START`)

  try {
    // Only use defaults when truly offline (local dev without DB)
    if (!isDatabaseAvailable()) {
      console.log(`📊 [promo-quota:${logId}] DB offline, returning defaults`)
      return NextResponse.json({
        code: 'TRADERCEPAT',
        maxQuota: 30,
        usedQuota: 0,
        remainingQuota: 30,
        discountPercent: 100,
        durationMonths: 3,
        isActive: true
      })
    }

    await ensureSchema()

    // EMERGENCY: Fix corrupted promo_codes if ensureSchema's singleton skipped it
    try {
      await db.$queryRawUnsafe(`SELECT user_id FROM public.promo_codes LIMIT 0;`)
      console.log(`🚨 [promo-quota:${logId}] EMERGENCY: promo_codes corrupted, force-dropping...`)
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS public.promo_codes CASCADE;`)
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "promo_codes" ("id" TEXT NOT NULL, "code" TEXT NOT NULL, "description" TEXT, "discount_percent" DOUBLE PRECISION NOT NULL, "max_quota" INTEGER NOT NULL, "used_quota" INTEGER NOT NULL DEFAULT 0, "duration_months" INTEGER NOT NULL, "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "end_date" TIMESTAMP(3), "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"));`)
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");`)
      await db.$executeRawUnsafe(`INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at) VALUES (gen_random_uuid()::text, 'TRADERCEPAT', 'Diskon 100% — 3 Bulan PRO Gratis!', 100, 30, 0, 3, NOW(), true, NOW(), NOW()) ON CONFLICT (code) DO NOTHING;`)
      console.log(`✅ [promo-quota:${logId}] EMERGENCY repair done`)
    } catch (_probeErr) { /* table clean or doesn't exist yet */ }

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    // Get promo data
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT id, code, description, discount_percent, max_quota, used_quota, duration_months, is_active
       FROM promo_codes WHERE code = $1`,
      code
    )

    if (!rows || rows.length === 0) {
      console.error(`❌ [promo-quota:${logId}] Promo ${code} not found`)
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    const promo = rows[0]
    console.log(`📊 [promo-quota:${logId}] Raw DB: used=${promo.used_quota}, max=${promo.max_quota}, active=${promo.is_active}`)

    // SELF-HEAL: Verify used_quota matches real subscription count
    try {
      const countRows: any[] = await db.$queryRawUnsafe(`
        SELECT COUNT(*)::int as cnt FROM user_subscriptions
        WHERE promo_code_id = $1 AND status = 'active';
      `, promo.id)
      const realCount = countRows?.[0]?.cnt ?? 0
      const storedUsed = Number(promo.used_quota)

      console.log(`📊 [promo-quota:${logId}] Real subscription count: ${realCount}, stored: ${storedUsed}`)

      if (storedUsed !== realCount) {
        console.log(`🔧 [promo-quota:${logId}] FIX: used_quota ${storedUsed} → ${realCount}`)
        await db.$executeRawUnsafe(`
          UPDATE promo_codes SET used_quota = $1, updated_at = NOW() WHERE id = $2;
        `, realCount, promo.id)

        const fixedRows: any[] = await db.$queryRawUnsafe(
          `SELECT used_quota, is_active, max_quota FROM promo_codes WHERE code = $1`,
          code
        )
        if (fixedRows?.length > 0) {
          promo.used_quota = fixedRows[0].used_quota
          promo.is_active = fixedRows[0].is_active
        }
      }

      // Fix is_active if inconsistent
      const realUsed = Number(promo.used_quota)
      const realMax = Number(promo.max_quota)
      if (promo.is_active && realUsed >= realMax) {
        await db.$executeRawUnsafe(`UPDATE promo_codes SET is_active = false, updated_at = NOW() WHERE id = $1;`, promo.id)
        promo.is_active = false
        console.log(`🔧 [promo-quota:${logId}] Deactivated (full)`) 
      } else if (!promo.is_active && realUsed < realMax) {
        await db.$executeRawUnsafe(`UPDATE promo_codes SET is_active = true, end_date = NULL, updated_at = NOW() WHERE id = $1;`, promo.id)
        promo.is_active = true
        console.log(`🔧 [promo-quota:${logId}] Re-activated (has slots)`)
      }
    } catch (fixErr: any) {
      console.error(`⚠️ [promo-quota:${logId}] Self-heal error (non-critical):`, fixErr?.message)
    }

    const usedQuota = Number(promo.used_quota)
    const maxQuota = Number(promo.max_quota)

    console.log(`📊 [promo-quota:${logId}] FINAL: used=${usedQuota}, max=${maxQuota}, remaining=${Math.max(0, maxQuota - usedQuota)}, active=${promo.is_active}`)

    return NextResponse.json({
      code: promo.code,
      maxQuota,
      usedQuota,
      remainingQuota: Math.max(0, maxQuota - usedQuota),
      discountPercent: Number(promo.discount_percent) || 100,
      durationMonths: Number(promo.duration_months) || 3,
      isActive: promo.is_active
    })
  } catch (error: any) {
    console.error(`💥 [promo-quota:${logId}] FATAL:`, error?.message, error?.stack)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}