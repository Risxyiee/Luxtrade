import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * POST /api/promo/apply
 * 
 * Does NOT call ensureSchema() — that function has a singleton flag and
 * may contain queries that fail on corrupted tables. Instead, this route
 * does its own minimal table check/repair before claiming.
 */

const PROMO_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discount_percent" DOUBLE PRECISION NOT NULL,
  "max_quota" INTEGER NOT NULL,
  "used_quota" INTEGER NOT NULL DEFAULT 0,
  "duration_months" INTEGER NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "end_date" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);`

const SUB_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "user_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "end_date" TIMESTAMP(3),
  "promo_code_id" TEXT,
  "discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);`

/** Try a query, return true if it succeeds */
async function queryOk(sql: string, ...params: any[]): Promise<boolean> {
  try {
    await db.$executeRawUnsafe(sql, ...params)
    return true
  } catch { return false }
}

/** Force-repair promo_codes: DROP if corrupted, CREATE clean, INSERT TRADERCEPAT */
async function forceRepairPromoTable(): Promise<boolean> {
  try {
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS public.promo_codes CASCADE;`)
    await db.$executeRawUnsafe(PROMO_TABLE_SQL)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");`)
    await db.$executeRawUnsafe(`
      INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at)
      VALUES (gen_random_uuid()::text, 'TRADERCEPAT', 'Diskon 100% — 3 Bulan PRO Gratis! Khusus 30 trader pertama.', 100, 30, 0, 3, NOW(), true, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING;
    `)
    return true
  } catch (e: any) {
    console.error('❌ [forceRepair] Failed:', e?.message)
    return false
  }
}

export async function POST(request: NextRequest) {
  const logId = Math.random().toString(36).substring(2, 8)
  console.log(`🔄 [promo/apply:${logId}] START`)

  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json({ success: false, message: 'Database sedang tidak tersedia. Coba lagi nanti.' })
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 0: Ensure tables exist with CORRECT schema (no ensureSchema)
    // ══════════════════════════════════════════════════════════════
    console.log(`🔧 [promo/apply:${logId}] Checking tables...`)

    // Ensure user_subscriptions exists
    const subOk = await queryOk(SUB_TABLE_SQL)
    console.log(`🔧 [promo/apply:${logId}] user_subscriptions: ${subOk ? 'OK' : 'FAILED'}`)

    // Test if promo_codes is usable by doing a simple SELECT
    let promoTableClean = false
    try {
      await db.$queryRawUnsafe(`SELECT code FROM public.promo_codes LIMIT 0;`)
      promoTableClean = true
      console.log(`🔧 [promo/apply:${logId}] promo_codes: exists`)
    } catch (testErr: any) {
      console.log(`🔧 [promo/apply:${logId}] promo_codes test failed: ${testErr?.message?.substring(0, 80)}`)
    }

    if (!promoTableClean) {
      // Table doesn't exist or has serious issues — create fresh
      console.log(`🔧 [promo/apply:${logId}] Creating promo_codes from scratch...`)
      const repaired = await forceRepairPromoTable()
      console.log(`🔧 [promo/apply:${logId}] Repair: ${repaired ? 'OK' : 'FAILED'}`)
    } else {
      // Table exists — check if TRADERCEPAT row exists and is correct
      // Do this with a simple, safe query that only uses the 12 clean columns
      try {
        const check: any[] = await db.$queryRawUnsafe(
          `SELECT id, is_active, used_quota, max_quota FROM public.promo_codes WHERE code = 'TRADERCEPAT' LIMIT 1;`
        )
        if (!check || check.length === 0) {
          // TRADERCEPAT not found — insert it
          console.log(`🔧 [promo/apply:${logId}] TRADERCEPAT not found, inserting...`)
          await db.$executeRawUnsafe(`
            INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at)
            VALUES (gen_random_uuid()::text, 'TRADERCEPAT', 'Diskon 100% — 3 Bulan PRO Gratis!', 100, 30, 0, 3, NOW(), true, NOW(), NOW())
            ON CONFLICT (code) DO NOTHING;
          `)
        } else {
          console.log(`🔧 [promo/apply:${logId}] TRADERCEPAT found: active=${check[0].is_active}, used=${check[0].used_quota}/${check[0].max_quota}`)

          // Fix if needed: force activate + correct values
          await db.$executeRawUnsafe(`
            UPDATE promo_codes SET
              max_quota = 30,
              duration_months = 3,
              is_active = true,
              end_date = NULL,
              updated_at = NOW()
            WHERE code = 'TRADERCEPAT';
          `)

          // Sync used_quota to real count
          try {
            await db.$executeRawUnsafe(`
              UPDATE promo_codes SET used_quota = (
                SELECT COUNT(*) FROM user_subscriptions
                WHERE user_subscriptions.promo_code_id = promo_codes.id AND user_subscriptions.status = 'active'
              ), updated_at = NOW() WHERE code = 'TRADERCEPAT';
            `)
          } catch (syncErr: any) {
            console.warn(`⚠️ [promo/apply:${logId}] Quota sync failed (non-critical): ${syncErr?.message?.substring(0, 80)}`)
          }
        }
      } catch (checkErr: any) {
        // If even SELECT fails with "user_id does not exist", table is corrupted — nuke it
        console.error(`🚨 [promo/apply:${logId}] SELECT on promo_codes failed: ${checkErr?.message?.substring(0, 100)}`)
        if (checkErr?.message?.includes('user_id') || checkErr?.code === '42703') {
          console.log(`🚨 [promo/apply:${logId}] Corrupted table detected! Dropping and recreating...`)
          const repaired = await forceRepairPromoTable()
          console.log(`🔧 [promo/apply:${logId}] Repair: ${repaired ? 'OK' : 'FAILED'}`)
        }
      }
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 1: Auth
    // ══════════════════════════════════════════════════════════════
    const body = await request.json()
    const { promoCode: code, plan } = body
    console.log(`📝 [promo/apply:${logId}] code=${code?.trim()?.toUpperCase()}, plan=${plan}`)

    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error(`❌ [promo/apply:${logId}] Auth failed`)
      return NextResponse.json({ error: 'Unauthorized. Please login first.' }, { status: 401 })
    }

    const userId = user.id
    console.log(`👤 [promo/apply:${logId}] userId=${userId}`)

    if (!code || !plan) {
      return NextResponse.json({ success: false, message: 'promoCode and plan are required' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    // ══════════════════════════════════════════════════════════════
    // STEP 2: ATOMIC claim
    // ══════════════════════════════════════════════════════════════
    console.log(`🔍 [promo/apply:${logId}] Atomic claim for ${normalizedCode}...`)
    let promoResult: any[] = await db.$queryRawUnsafe(`
      UPDATE public.promo_codes
      SET used_quota = used_quota + 1, updated_at = NOW()
      WHERE code = $1
        AND is_active = true
        AND (end_date IS NULL OR end_date > NOW())
        AND start_date <= NOW()
        AND used_quota < max_quota
      RETURNING id, code, description, discount_percent, max_quota, used_quota, duration_months;
    `, normalizedCode)
    console.log(`📊 [promo/apply:${logId}] Atomic: ${promoResult?.length ?? 0} rows`)

    // ══════════════════════════════════════════════════════════════
    // STEP 3: If atomic failed, diagnose and self-heal
    // ══════════════════════════════════════════════════════════════
    if (!promoResult || promoResult.length === 0) {
      // Read current promo state (simple query, only clean columns)
      const promoCheck: any[] = await db.$queryRawUnsafe(`
        SELECT id, is_active, used_quota, max_quota, end_date, start_date
        FROM public.promo_codes WHERE code = $1 LIMIT 1;
      `, normalizedCode)
      console.log(`📊 [promo/apply:${logId}] State:`, promoCheck?.[0] || 'NOT FOUND')

      if (!promoCheck || promoCheck.length === 0) {
        return NextResponse.json({ success: false, message: 'Kode promo tidak valid' })
      }

      const p = promoCheck[0]

      // If inactive, check real usage and try to fix
      if (!p.is_active && normalizedCode === 'TRADERCEPAT') {
        let realUsed = 0
        try {
          const rc: any[] = await db.$queryRawUnsafe(
            `SELECT COUNT(*)::int as cnt FROM user_subscriptions WHERE promo_code_id = $1 AND status = 'active';`, p.id
          )
          realUsed = rc?.[0]?.cnt ?? 0
        } catch { /* table might not exist */ }

        if (realUsed < 30) {
          console.log(`🔧 [promo/apply:${logId}] Re-activating (realUsed=${realUsed})...`)
          await db.$executeRawUnsafe(
            `UPDATE public.promo_codes SET is_active = true, used_quota = $1, end_date = NULL, updated_at = NOW() WHERE id = $2;`,
            realUsed, p.id
          )
          // Retry
          promoResult = await db.$queryRawUnsafe(`
            UPDATE public.promo_codes SET used_quota = used_quota + 1, updated_at = NOW()
            WHERE code = $1 AND is_active = true AND (end_date IS NULL OR end_date > NOW()) AND start_date <= NOW() AND used_quota < max_quota
            RETURNING id, code, description, discount_percent, max_quota, used_quota, duration_months;
          `, normalizedCode)

          if (!promoResult || promoResult.length === 0) {
            return NextResponse.json({ success: false, message: 'Gagal mengaktifkan kode promo. Coba lagi.' })
          }
        } else {
          return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis.' })
        }
      } else if (!p.is_active) {
        return NextResponse.json({ success: false, message: 'Kode promo tidak aktif' })
      }

      // If still no result after self-heal, check quota
      if (!promoResult || promoResult.length === 0) {
        if (p.start_date && new Date(p.start_date) > new Date()) {
          return NextResponse.json({ success: false, message: 'Kode promo belum aktif' })
        }
        if (p.end_date && new Date(p.end_date) <= new Date()) {
          return NextResponse.json({ success: false, message: 'Kode promo sudah kadaluarsa' })
        }
        return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis.' })
      }
    }

    const promo = promoResult[0]
    console.log(`🎫 [promo/apply:${logId}] Claimed: ${promo.code} used=${promo.used_quota}/${promo.max_quota}`)

    // ══════════════════════════════════════════════════════════════
    // STEP 4: Duplicate check
    // ══════════════════════════════════════════════════════════════
    const existingSub: any[] = await db.$queryRawUnsafe(`
      SELECT id FROM user_subscriptions WHERE user_id = $1 AND promo_code_id = $2 AND status = 'active' LIMIT 1;
    `, userId, promo.id)

    if (existingSub && existingSub.length > 0) {
      await db.$executeRawUnsafe(`UPDATE public.promo_codes SET used_quota = used_quota - 1, updated_at = NOW() WHERE id = $1;`, promo.id)
      return NextResponse.json({ success: false, message: 'Anda sudah menggunakan kode promo ini sebelumnya' })
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 5: Create subscription + upgrade profile
    // ══════════════════════════════════════════════════════════════
    const startDate = new Date()
    const months = promo.duration_months || 3
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)
    const subscriptionId = randomUUID()

    await db.$executeRawUnsafe(`
      INSERT INTO user_subscriptions (id, user_id, plan, status, start_date, end_date, promo_code_id, discount_percent, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', NOW(), $4, $5, $6, NOW(), NOW());
    `, subscriptionId, userId, plan, endDate, promo.id, promo.discount_percent)
    console.log(`✅ [promo/apply:${logId}] Subscription created`)

    await db.$executeRawUnsafe(`
      UPDATE profiles SET plan = 'PRO', is_pro = true, subscription_until = $1, pro_expiry = $1, updated_at = NOW() WHERE id = $2;
    `, endDate, userId)
    console.log(`✅ [promo/apply:${logId}] Profile → PRO`)

    // Sync Supabase Auth metadata (non-critical)
    try {
      const { supabaseAdmin: adminClient } = await import('@/lib/supabase-admin-alt')
      if (adminClient) {
        const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(userId)
        const currentMeta = authUser?.user_metadata || {}
        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: { ...currentMeta, is_pro: true, subscription_status: 'active', subscription_until: endDate.toISOString(), has_ever_been_pro: true, updated_at: new Date().toISOString() }
        })
      }
    } catch (metaErr: any) {
      console.warn(`⚠️ [promo/apply:${logId}] Auth meta sync failed: ${metaErr?.message?.substring(0, 60)}`)
    }

    const remainingQuota = Number(promo.max_quota) - Number(promo.used_quota)
    if (remainingQuota <= 0) {
      try { await db.$executeRawUnsafe(`UPDATE public.promo_codes SET is_active = false, updated_at = NOW() WHERE id = $1;`, promo.id) } catch { /* ok */ }
    }

    console.log(`🎉 [promo/apply:${logId}] SUCCESS — ${plan} ${months}mo, remaining=${remainingQuota}`)

    return NextResponse.json({
      success: true,
      message: `Kode promo berhasil diterapkan! Anda mendapatkan akses ${plan} selama ${months} bulan.`,
      subscription: { id: subscriptionId, plan, status: 'active', startDate: startDate.toISOString(), endDate: endDate.toISOString(), discountPercent: Number(promo.discount_percent) },
      promoCode: { code: promo.code, remainingQuota }
    })
  } catch (error: any) {
    console.error(`💥 [promo/apply:${logId}] FATAL: ${error?.message}`)
    console.error(`💥 [promo/apply:${logId}] Code: ${error?.code}`)
    console.error(`💥 [promo/apply:${logId}] Stack: ${error?.stack}`)
    return NextResponse.json({ success: false, message: `Gagal menerapkan kode promo: ${error?.message || 'Unknown error'}` })
  }
}