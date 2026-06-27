import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db, ensureSchema, isDatabaseAvailable } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * Apply promo code to user subscription
 * POST /api/promo/apply
 * Body: { promoCode: string, plan?: string }
 *
 * KEY FIX: Uses atomic SQL to check + increment quota in one query.
 * SELF-HEALING: If the promo appears full but real subscription count
 * is less than max_quota, auto-fixes used_quota and retries once.
 */
export async function POST(request: NextRequest) {
  const logId = Math.random().toString(36).substring(2, 8)
  console.log(`🔄 [promo/apply:${logId}] START`)

  try {
    // ── DB Check ──
    if (!isDatabaseAvailable()) {
      console.error(`❌ [promo/apply:${logId}] Database not available`)
      return NextResponse.json({ success: false, message: 'Database sedang tidak tersedia. Coba lagi nanti.' })
    }

    await ensureSchema()
    console.log(`✅ [promo/apply:${logId}] Schema ensured`)

    // ── EMERGENCY: If promo_codes still has corrupted "user_id" column,
    //    ensureSchema's singleton flag may have skipped the fix on a warm instance.
    //    Force-repair here. ──
    try {
      await db.$queryRawUnsafe(`SELECT user_id FROM public.promo_codes LIMIT 0;`)
      // If no error → table IS corrupted (has user_id). Nuke it.
      console.log(`🚨 [promo/apply:${logId}] EMERGENCY: promo_codes still corrupted, force-dropping...`)
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS public.promo_codes CASCADE;`)
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "promo_codes" (
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
        );`)
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");`)
      // Re-insert TRADERCEPAT
      await db.$executeRawUnsafe(`
        INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at)
        VALUES (gen_random_uuid()::text, 'TRADERCEPAT', 'Diskon 100% — 3 Bulan PRO Gratis! Khusus 30 trader pertama.', 100, 30, 0, 3, NOW(), true, NOW(), NOW())
        ON CONFLICT (code) DO NOTHING;`)
      console.log(`✅ [promo/apply:${logId}] EMERGENCY repair done`)
    } catch (probeErr: any) {
      // "column user_id does not exist" = expected, table is clean
      if (!probeErr?.message?.includes('user_id') && !probeErr?.message?.includes('does not exist')) {
        console.warn(`⚠️ [promo/apply:${logId}] Probe error:`, probeErr?.message?.substring(0, 100))
      }
    }

    const body = await request.json()
    const { promoCode: code, plan } = body
    console.log(`📝 [promo/apply:${logId}] code=${code?.trim()?.toUpperCase()}, plan=${plan}`)

    // ── Auth ──
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error(`❌ [promo/apply:${logId}] Auth error:`, authError.message)
      return NextResponse.json({ error: 'Unauthorized. Please login first.' }, { status: 401 })
    }
    if (!user) {
      console.error(`❌ [promo/apply:${logId}] No user in session`)
      return NextResponse.json({ error: 'Unauthorized. Please login first.' }, { status: 401 })
    }

    const userId = user.id
    console.log(`👤 [promo/apply:${logId}] userId=${userId}`)

    if (!code || !plan) {
      console.error(`❌ [promo/apply:${logId}] Missing params: code=${!!code}, plan=${!!plan}`)
      return NextResponse.json({ success: false, message: 'promoCode and plan are required' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    // ── ATOMIC: Check promo validity + increment quota ──
    console.log(`🔍 [promo/apply:${logId}] Attempting atomic claim for ${normalizedCode}...`)
    let promoResult: any[] = await db.$queryRawUnsafe(`
      UPDATE promo_codes
      SET used_quota = used_quota + 1, updated_at = NOW()
      WHERE code = $1
        AND is_active = true
        AND (end_date IS NULL OR end_date > NOW())
        AND start_date <= NOW()
        AND used_quota < max_quota
      RETURNING id, code, description, discount_percent, max_quota, used_quota, duration_months;
    `, normalizedCode)
    console.log(`📊 [promo/apply:${logId}] Atomic result: ${promoResult?.length ?? 0} rows`)

    // ── SELF-HEALING ──
    if (!promoResult || promoResult.length === 0) {
      console.log(`⚠️ [promo/apply:${logId}] Atomic claim failed, checking promo state...`)
      const promoCheck: any[] = await db.$queryRawUnsafe(`
        SELECT id, is_active, used_quota, max_quota, end_date, start_date
        FROM promo_codes WHERE code = $1 LIMIT 1;
      `, normalizedCode)
      console.log(`📊 [promo/apply:${logId}] Promo state:`, promoCheck?.[0] ? {
        is_active: promoCheck[0].is_active,
        used_quota: promoCheck[0].used_quota,
        max_quota: promoCheck[0].max_quota,
        end_date: promoCheck[0].end_date,
        start_date: promoCheck[0].start_date,
      } : 'NOT FOUND')

      if (!promoCheck || promoCheck.length === 0) {
        console.error(`❌ [promo/apply:${logId}] Promo ${normalizedCode} not found in DB`)
        return NextResponse.json({ success: false, message: 'Kode promo tidak valid' })
      }

      const p = promoCheck[0]

      if (!p.is_active) {
        // SELF-HEAL for TRADERCEPAT
        if (normalizedCode === 'TRADERCEPAT') {
          const realCount: any[] = await db.$queryRawUnsafe(`
            SELECT COUNT(*)::int as cnt FROM user_subscriptions
            WHERE promo_code_id = $1 AND status = 'active';
          `, p.id)
          const realUsed = realCount?.[0]?.cnt ?? 0
          const realMax = Number(p.max_quota)
          console.log(`🔧 [promo/apply:${logId}] SELF-HEAL: promo inactive, realUsed=${realUsed}, realMax=${realMax}`)

          if (realUsed < realMax) {
            console.log(`🔧 [promo/apply:${logId}] Re-activating ${normalizedCode}...`)
            await db.$executeRawUnsafe(`
              UPDATE promo_codes
              SET is_active = true, used_quota = $1, end_date = NULL, updated_at = NOW()
              WHERE id = $2;
            `, realUsed, p.id)

            promoResult = await db.$queryRawUnsafe(`
              UPDATE promo_codes
              SET used_quota = used_quota + 1, updated_at = NOW()
              WHERE code = $1
                AND is_active = true
                AND (end_date IS NULL OR end_date > NOW())
                AND start_date <= NOW()
                AND used_quota < max_quota
              RETURNING id, code, description, discount_percent, max_quota, used_quota, duration_months;
            `, normalizedCode)
            console.log(`📊 [promo/apply:${logId}] After self-heal retry: ${promoResult?.length ?? 0} rows`)

            if (!(promoResult && promoResult.length > 0)) {
              console.error(`❌ [promo/apply:${logId}] Self-heal retry still failed`)
              return NextResponse.json({ success: false, message: 'Gagal mengaktifkan kode promo. Coba lagi.' })
            }
            console.log(`✅ [promo/apply:${logId}] SELF-HEAL SUCCESS`)
          } else {
            console.log(`❌ [promo/apply:${logId}] Truly full: ${realUsed}/${realMax}`)
            return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis.' })
          }
        } else {
          console.error(`❌ [promo/apply:${logId}] Promo ${normalizedCode} is_active=false`)
          return NextResponse.json({ success: false, message: 'Kode promo tidak aktif' })
        }
      }

      if (promoResult.length === 0) {
        if (p.start_date && new Date(p.start_date) > new Date()) {
          return NextResponse.json({ success: false, message: 'Kode promo belum aktif' })
        }
        if (p.end_date && new Date(p.end_date) <= new Date()) {
          return NextResponse.json({ success: false, message: 'Kode promo sudah kadaluarsa' })
        }

        // Quota verification
        const realCount: any[] = await db.$queryRawUnsafe(`
          SELECT COUNT(*)::int as cnt FROM user_subscriptions
          WHERE promo_code_id = $1 AND status = 'active';
        `, p.id)
        const realUsed = realCount?.[0]?.cnt ?? 0
        const realMax = Number(p.max_quota)
        console.log(`📊 [promo/apply:${logId}] Quota check: stored=${p.used_quota}, real=${realUsed}, max=${realMax}`)

        if (realUsed < realMax && Number(p.used_quota) !== realUsed) {
          console.log(`🔧 [promo/apply:${logId}] Fixing used_quota ${p.used_quota} → ${realUsed}...`)
          await db.$executeRawUnsafe(`
            UPDATE promo_codes SET used_quota = $1, is_active = true, updated_at = NOW() WHERE id = $2;
          `, realUsed, p.id)

          promoResult = await db.$queryRawUnsafe(`
            UPDATE promo_codes
            SET used_quota = used_quota + 1, updated_at = NOW()
            WHERE code = $1 AND is_active = true AND (end_date IS NULL OR end_date > NOW()) AND start_date <= NOW() AND used_quota < max_quota
            RETURNING id, code, description, discount_percent, max_quota, used_quota, duration_months;
          `, normalizedCode)
          console.log(`📊 [promo/apply:${logId}] After quota fix retry: ${promoResult?.length ?? 0} rows`)

          if (!(promoResult && promoResult.length > 0)) {
            console.error(`❌ [promo/apply:${logId}] Quota fix retry still failed`)
            return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis.' })
          }
          console.log(`✅ [promo/apply:${logId}] QUOTA FIX SUCCESS`)
        } else {
          console.log(`❌ [promo/apply:${logId}] Truly full: ${realUsed}/${realMax}`)
          return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis.' })
        }
      }
    }

    const promo = promoResult[0]
    console.log(`🎫 [promo/apply:${logId}] Promo claimed: ${promo.code}, used=${promo.used_quota}/${promo.max_quota}`)

    // ── Duplicate check ──
    const existingSub: any[] = await db.$queryRawUnsafe(`
      SELECT id FROM user_subscriptions WHERE user_id = $1 AND promo_code_id = $2 AND status = 'active' LIMIT 1;
    `, userId, promo.id)

    if (existingSub && existingSub.length > 0) {
      console.log(`⚠️ [promo/apply:${logId}] User ${userId} already used this promo, rolling back quota`)
      await db.$executeRawUnsafe(`UPDATE promo_codes SET used_quota = used_quota - 1, updated_at = NOW() WHERE id = $1;`, promo.id)
      return NextResponse.json({ success: false, message: 'Anda sudah menggunakan kode promo ini sebelumnya' })
    }

    // ── Create subscription ──
    const startDate = new Date()
    const months = promo.duration_months || 3
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)
    const subscriptionId = randomUUID()

    await db.$executeRawUnsafe(`
      INSERT INTO user_subscriptions (id, user_id, plan, status, start_date, end_date, promo_code_id, discount_percent, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', NOW(), $4, $5, $6, NOW(), NOW());
    `, subscriptionId, userId, plan, endDate, promo.id, promo.discount_percent)
    console.log(`✅ [promo/apply:${logId}] Subscription created: ${subscriptionId}`)

    // ── Update profile ──
    await db.$executeRawUnsafe(`
      UPDATE profiles SET plan = 'PRO', is_pro = true, subscription_until = $1, pro_expiry = $1, updated_at = NOW() WHERE id = $2;
    `, endDate, userId)
    console.log(`✅ [promo/apply:${logId}] Profile updated to PRO for ${userId}`)

    // ── Sync Supabase Auth metadata ──
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
      console.warn(`⚠️ [promo/apply:${logId}] Auth metadata sync failed (non-critical):`, metaErr?.message)
    }

    const remainingQuota = Number(promo.max_quota) - Number(promo.used_quota)

    // Auto-deactivate if full
    if (remainingQuota <= 0) {
      try {
        await db.$executeRawUnsafe(`UPDATE promo_codes SET is_active = false, updated_at = NOW() WHERE id = $1;`, promo.id)
        console.log(`🔒 [promo/apply:${logId}] Promo auto-deactivated — quota penuh`)
      } catch { /* non-critical */ }
    }

    console.log(`🎉 [promo/apply:${logId}] SUCCESS — ${plan} for ${months} months, remaining=${remainingQuota}`)

    return NextResponse.json({
      success: true,
      message: `Kode promo berhasil diterapkan! Anda mendapatkan akses ${plan} selama ${months} bulan.`,
      subscription: { id: subscriptionId, plan, status: 'active', startDate: startDate.toISOString(), endDate: endDate.toISOString(), discountPercent: Number(promo.discount_percent) },
      promoCode: { code: promo.code, remainingQuota }
    })
  } catch (error: any) {
    console.error(`💥 [promo/apply:${logId}] FATAL ERROR:`, error?.message)
    console.error(`💥 [promo/apply:${logId}] Stack:`, error?.stack)
    return NextResponse.json({ success: false, message: `Gagal menerapkan kode promo: ${error?.message || 'Unknown error'}` })
  }
}