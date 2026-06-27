import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

const PROMO_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "description" TEXT,
  "discount_percent" DOUBLE PRECISION NOT NULL, "max_quota" INTEGER NOT NULL,
  "used_quota" INTEGER NOT NULL DEFAULT 0, "duration_months" INTEGER NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "end_date" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);`

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const logId = Math.random().toString(36).substring(2, 8)
  console.log(`📊 [promo-quota:${logId}] START`)

  try {
    if (!isDatabaseAvailable()) {
      console.log(`📊 [promo-quota:${logId}] DB offline, defaults`)
      return NextResponse.json({ code: 'TRADERCEPAT', maxQuota: 30, usedQuota: 0, remainingQuota: 30, discountPercent: 100, durationMonths: 3, isActive: true })
    }

    // ── Self-repair: don't call ensureSchema, handle table ourselves ──
    try {
      await db.$queryRawUnsafe(`SELECT code FROM public.promo_codes LIMIT 0;`)
    } catch (testErr: any) {
      // Table broken or missing — recreate
      console.log(`🔧 [promo-quota:${logId}] Table broken (${testErr?.code}), recreating...`)
      try {
        await db.$executeRawUnsafe(`DROP TABLE IF EXISTS public.promo_codes CASCADE;`)
        await db.$executeRawUnsafe(PROMO_TABLE_SQL)
        await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");`)
        await db.$executeRawUnsafe(`INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at) VALUES (gen_random_uuid()::text, 'TRADERCEPAT', 'Diskon 100% — 3 Bulan PRO Gratis!', 100, 30, 0, 3, NOW(), true, NOW(), NOW()) ON CONFLICT (code) DO NOTHING;`)
        console.log(`✅ [promo-quota:${logId}] Table recreated`)
      } catch (repairErr: any) {
        console.error(`❌ [promo-quota:${logId}] Repair failed: ${repairErr?.message}`)
      }
    }

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT id, code, discount_percent, max_quota, used_quota, duration_months, is_active FROM public.promo_codes WHERE code = $1`, code
    )

    if (!rows || rows.length === 0) {
      console.error(`❌ [promo-quota:${logId}] ${code} not found`)
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    const promo = rows[0]
    console.log(`📊 [promo-quota:${logId}] Raw: used=${promo.used_quota}, max=${promo.max_quota}, active=${promo.is_active}`)

    // Self-heal: sync used_quota to real subscription count
    try {
      const countRows: any[] = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM user_subscriptions WHERE promo_code_id = $1 AND status = 'active';`, promo.id
      )
      const realCount = countRows?.[0]?.cnt ?? 0
      const storedUsed = Number(promo.used_quota)

      if (storedUsed !== realCount) {
        console.log(`🔧 [promo-quota:${logId}] Fix: ${storedUsed} → ${realCount}`)
        await db.$executeRawUnsafe(`UPDATE public.promo_codes SET used_quota = $1, updated_at = NOW() WHERE id = $2;`, realCount, promo.id)
        promo.used_quota = realCount
      }

      const realUsed = Number(promo.used_quota)
      const realMax = Number(promo.max_quota)
      if (promo.is_active && realUsed >= realMax) {
        await db.$executeRawUnsafe(`UPDATE public.promo_codes SET is_active = false, updated_at = NOW() WHERE id = $1;`, promo.id)
        promo.is_active = false
      } else if (!promo.is_active && realUsed < realMax) {
        await db.$executeRawUnsafe(`UPDATE public.promo_codes SET is_active = true, end_date = NULL, updated_at = NOW() WHERE id = $1;`, promo.id)
        promo.is_active = true
      }
    } catch (fixErr: any) {
      console.warn(`⚠️ [promo-quota:${logId}] Heal error: ${fixErr?.message?.substring(0, 60)}`)
    }

    const usedQuota = Number(promo.used_quota)
    const maxQuota = Number(promo.max_quota)
    console.log(`📊 [promo-quota:${logId}] FINAL: used=${usedQuota}, max=${maxQuota}, remaining=${Math.max(0, maxQuota - usedQuota)}, active=${promo.is_active}`)

    return NextResponse.json({
      code: promo.code, maxQuota, usedQuota,
      remainingQuota: Math.max(0, maxQuota - usedQuota),
      discountPercent: Number(promo.discount_percent) || 100,
      durationMonths: Number(promo.duration_months) || 3,
      isActive: promo.is_active
    })
  } catch (error: any) {
    console.error(`💥 [promo-quota:${logId}] FATAL: ${error?.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}