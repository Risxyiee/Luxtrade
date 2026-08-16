import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * POST /api/promo/apply
 *
 * Applies a promo code using ATOMIC quota claim (single UPDATE ... WHERE).
 * NO table drops — the previous version had a critical bug where
 * DROP+CREATE on every request reset used_quota to 0, making the
 * 30-slot limit completely ineffective (infinite redemptions).
 */

async function ensurePromoTables() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id TEXT PRIMARY KEY, code TEXT NOT NULL, description TEXT,
        discount_percent DOUBLE PRECISION NOT NULL, max_quota INTEGER NOT NULL,
        used_quota INTEGER NOT NULL DEFAULT 0, duration_months INTEGER NOT NULL,
        start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), end_date TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), end_date TIMESTAMPTZ,
        promo_code_id TEXT, discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  } catch {}
}

export async function POST(request: NextRequest) {
  const logId = Math.random().toString(36).substring(2, 8)
  console.log(`🔄 [promo/apply:${logId}] START`)

  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json({ success: false, message: 'Database sedang tidak tersedia. Coba lagi nanti.' })
    }

    // Ensure tables exist
    await ensurePromoTables()

    // ══════════════════════════════════════════════════════════════
    // STEP 1: Auth + parse body
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
    // STEP 2: ATOMIC claim — single UPDATE WHERE used_quota < max_quota
    // This is race-condition safe. If quota is full, UPDATE returns 0 rows.
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
    // STEP 3: Duplicate check
    // ══════════════════════════════════════════════════════════════
    let existingSub: any[] = []
    try {
      existingSub = await db.$queryRawUnsafe(`
        SELECT id FROM user_subscriptions WHERE user_id = $1 AND promo_code_id = $2 AND status = 'active' LIMIT 1;
      `, userId, promo.id)
    } catch (subErr: any) {
      console.error(`🚨 [promo/apply:${logId}] user_subscriptions query failed: ${subErr?.message?.substring(0, 100)}`)
      // Table might be missing — rollback quota and tell user to try again
      await db.$executeRawUnsafe(`UPDATE public.promo_codes SET used_quota = used_quota - 1, updated_at = NOW() WHERE id = $1;`, promo.id)
      return NextResponse.json({ success: false, message: 'Gagal memeriksa subscription. Coba lagi.' })
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
      try { await db.$executeRawUnsafe(`UPDATE public.promo_codes SET used_quota = used_quota - 1, updated_at = NOW() WHERE id = $1;`, promo.id) } catch { /* ok */ }
      return NextResponse.json({ success: false, message: 'Gagal membuat subscription. Coba lagi.' })
    }

    // Update profile — CRITICAL: this is what actually enables PRO features
    // If profile doesn't exist, try to create it (user may have registered but never had a profile row)
    let profileUpdated = false
    try {
      const profileResult = await db.$executeRawUnsafe(`
        UPDATE profiles SET plan = 'PRO', is_pro = true, subscription_until = $1, pro_expiry = $1, updated_at = NOW() WHERE id = $2;
      `, endDate, userId)
      if (profileResult && profileResult.rowCount > 0) {
        profileUpdated = true
        console.log(`✅ [promo/apply:${logId}] Profile → PRO (userId=${userId})`)
      } else {
        // Profile not found — try to create it
        console.warn(`⚠️ [promo/apply:${logId}] Profile not found for ${userId}, attempting to create...`)
        try {
          await db.$executeRawUnsafe(`
            INSERT INTO profiles (id, plan, is_pro, subscription_until, pro_expiry, created_at, updated_at)
            VALUES ($1, 'PRO', true, $2, $2, NOW(), NOW());
          `, userId, endDate)
          profileUpdated = true
          console.log(`✅ [promo/apply:${logId}] Profile CREATED + PRO (userId=${userId})`)
        } catch (createErr: any) {
          console.error(`❌ [promo/apply:${logId}] Profile CREATE failed: ${createErr?.message?.substring(0, 100)}`)
        }
      }
    } catch (profErr: any) {
      console.error(`❌ [promo/apply:${logId}] Profile UPDATE FAILED: ${profErr?.message}`)
    }

    if (!profileUpdated) {
      try {
        await db.$executeRawUnsafe(`DELETE FROM user_subscriptions WHERE id = $1;`, subscriptionId)
      } catch { /* ok */ }
      try {
        await db.$executeRawUnsafe(`UPDATE public.promo_codes SET used_quota = used_quota - 1, updated_at = NOW() WHERE id = $1;`, promo.id)
      } catch { /* ok */ }
      return NextResponse.json({
        success: false,
        message: 'Gagal mengaktifkan PRO. Silakan hubungi admin untuk bantuan manual.',
        debugCode: 'PROFILE_UPDATE_FAILED'
      })
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

    // Auto-deactivate promo when full
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
    return NextResponse.json({ success: false, message: `Gagal menerapkan kode promo: ${error?.message || 'Unknown error'}` })
  }
}