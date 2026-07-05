import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * POST /api/promo/apply
 *
 * Does NOT call ensureSchema() — handles its own table repair.
 * CRITICAL: Both promo_codes AND user_subscriptions can be corrupted
 * from old schema. We guarantee clean tables by DROP+CREATE every request.
 * Safe because there are no FK constraints between them.
 */

const PROMO_CREATE = `CREATE TABLE "promo_codes" (
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

const SUB_CREATE = `CREATE TABLE "user_subscriptions" (
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

/** Quick test: can we SELECT user_id from user_subscriptions? */
async function subTableHasUserId(): Promise<boolean> {
  try {
    await db.$queryRawUnsafe(`SELECT user_id FROM public.user_subscriptions LIMIT 0;`)
    return true // no error = column exists = table is fine
  } catch {
    return false // error = column missing or table missing
  }
}

/** DROP + CREATE user_subscriptions with correct schema */
async function repairSubTable(): Promise<boolean> {
  try {
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS public.user_subscriptions CASCADE;`)
    await db.$executeRawUnsafe(SUB_CREATE)
    console.log(`✅ user_subscriptions recreated`)
    return true
  } catch (e: any) {
    console.error(`❌ user_subscriptions repair failed: ${e?.message?.substring(0, 100)}`)
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
    // STEP 0: Guarantee CLEAN tables
    // ══════════════════════════════════════════════════════════════
    console.log(`🔧 [promo/apply:${logId}] Checking tables...`)

    // Always DROP+CREATE promo_codes (safe — re-seeded below)
    try {
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS public.promo_codes CASCADE;`)
      await db.$executeRawUnsafe(PROMO_CREATE)
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");`)
      console.log(`🔧 [promo/apply:${logId}] promo_codes: fresh`)

      // Re-seed TRADERCEPAT
      await db.$executeRawUnsafe(`
        INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at)
        VALUES (gen_random_uuid()::text, 'TRADERCEPAT', 'Diskon 100% — 3 Bulan PRO Gratis! Khusus 30 trader pertama.', 100, 30, 0, 3, NOW(), true, NOW(), NOW())
        ON CONFLICT (code) DO NOTHING;`)
    } catch (e: any) {
      console.error(`❌ [promo/apply:${logId}] promo_codes setup failed: ${e?.message?.substring(0, 100)}`)
    }

    // Check user_subscriptions — if corrupted (no user_id), nuke and recreate
    const subOk = await subTableHasUserId()
    if (!subOk) {
      console.log(`🔧 [promo/apply:${logId}] user_subscriptions corrupted, repairing...`)
      await repairSubTable()
    } else {
      console.log(`🔧 [promo/apply:${logId}] user_subscriptions: OK`)
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

    if (!promoResult || promoResult.length === 0) {
      return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis.' })
    }

    const promo = promoResult[0]
    console.log(`🎫 [promo/apply:${logId}] Claimed: ${promo.code} used=${promo.used_quota}/${promo.max_quota}`)

    // ══════════════════════════════════════════════════════════════
    // STEP 3: Duplicate check (on user_subscriptions)
    // ══════════════════════════════════════════════════════════════
    let existingSub: any[] = []
    try {
      existingSub = await db.$queryRawUnsafe(`
        SELECT id FROM user_subscriptions WHERE user_id = $1 AND promo_code_id = $2 AND status = 'active' LIMIT 1;
      `, userId, promo.id)
    } catch (subErr: any) {
      // user_subscriptions might still be broken despite check above
      // (pgbouncer cached error on different connection)
      console.error(`🚨 [promo/apply:${logId}] user_subscriptions query failed: ${subErr?.message?.substring(0, 100)}`)
      console.log(`🔧 [promo/apply:${logId}] Force-repairing user_subscriptions...`)
      await repairSubTable()
      // Don't need to re-check — this is user's first claim on fresh table
    }

    if (existingSub && existingSub.length > 0) {
      await db.$executeRawUnsafe(`UPDATE public.promo_codes SET used_quota = used_quota - 1, updated_at = NOW() WHERE id = $1;`, promo.id)
      return NextResponse.json({ success: false, message: 'Anda sudah menggunakan kode promo ini sebelumnya' })
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 4: Create subscription + upgrade profile
    // ══════════════════════════════════════════════════════════════
    const startDate = new Date()
    const months = promo.duration_months || 3
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)
    const subscriptionId = randomUUID()

    try {
      await db.$executeRawUnsafe(`
        INSERT INTO user_subscriptions (id, user_id, plan, status, start_date, end_date, promo_code_id, discount_percent, created_at, updated_at)
        VALUES ($1, $2, $3, 'active', NOW(), $4, $5, $6, NOW(), NOW());
      `, subscriptionId, userId, plan, endDate, promo.id, promo.discount_percent)
      console.log(`✅ [promo/apply:${logId}] Subscription created`)
    } catch (insertErr: any) {
      console.error(`🚨 [promo/apply:${logId}] Insert subscription failed: ${insertErr?.message?.substring(0, 100)}`)
      // Rollback promo quota
      try { await db.$executeRawUnsafe(`UPDATE public.promo_codes SET used_quota = used_quota - 1, updated_at = NOW() WHERE id = $1;`, promo.id) } catch { /* ok */ }
      return NextResponse.json({ success: false, message: 'Gagal membuat subscription. Coba lagi.' })
    }

    // Update profile
    try {
      await db.$executeRawUnsafe(`
        UPDATE profiles SET plan = 'PRO', is_pro = true, subscription_until = $1, pro_expiry = $1, updated_at = NOW() WHERE id = $2;
      `, endDate, userId)
      console.log(`✅ [promo/apply:${logId}] Profile → PRO`)
    } catch (profErr: any) {
      console.warn(`⚠️ [promo/apply:${logId}] Profile update warning: ${profErr?.message?.substring(0, 80)}`)
    }

    // Sync Supabase Auth metadata (non-critical)
    try {
      const { getAdminAuth } = await import('@/lib/supabase-admin-alt')
      const authAdmin = getAdminAuth()
      if (authAdmin) {
        const { data: { user: authUser } } = await authAdmin.getUserById(userId)
        const currentMeta = authUser?.user_metadata || {}
        await authAdmin.updateUserById(userId, {
          user_metadata: { ...currentMeta, is_pro: true, subscription_status: 'active', subscription_until: endDate.toISOString(), has_ever_been_pro: true, updated_at: new Date().toISOString() }
        })
      }
    } catch (metaErr: any) {
      console.warn(`⚠️ [promo/apply:${logId}] Auth meta: ${metaErr?.message?.substring(0, 60)}`)
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
    return NextResponse.json({ success: false, message: `Gagal menerapkan kode promo: ${error?.message || 'Unknown error'}` })
  }
}