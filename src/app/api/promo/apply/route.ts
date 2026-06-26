import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db, ensureSchema } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * Apply promo code to user subscription
 * POST /api/promo/apply
 * Body: { promoCode: string, plan?: string }
 *
 * KEY FIX: Uses atomic SQL to check + increment quota in one query.
 * Prevents race condition where multiple concurrent requests all read
 * the same used_quota value before any of them increment it.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureSchema()
    const body = await request.json()
    const { promoCode: code, plan } = body

    // Get authenticated user from session
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      )
    }

    const userId = user.id

    if (!code || !plan) {
      return NextResponse.json(
        { error: 'promoCode and plan are required' },
        { status: 400 }
      )
    }

    // Normalize code to uppercase
    const normalizedCode = code.trim().toUpperCase()

    // ── ATOMIC: Check promo validity + increment quota in ONE SQL query ──
    // This prevents race conditions where multiple users check quota simultaneously
    const promoResult: any[] = await db.$queryRawUnsafe(`
      UPDATE promo_codes
      SET used_quota = used_quota + 1, updated_at = NOW()
      WHERE code = $1
        AND is_active = true
        AND (end_date IS NULL OR end_date > NOW())
        AND start_date <= NOW()
        AND used_quota < max_quota
      RETURNING id, code, description, discount_percent, max_quota, used_quota, duration_months;
    `, normalizedCode)

    // If no row returned, the promo is invalid/inactive/expired/quota-full
    if (!promoResult || promoResult.length === 0) {
      // Determine WHY it failed for a better error message
      const promoCheck: any[] = await db.$queryRawUnsafe(`
        SELECT is_active, used_quota, max_quota, end_date, start_date
        FROM promo_codes WHERE code = $1 LIMIT 1;
      `, normalizedCode)

      if (!promoCheck || promoCheck.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Kode promo tidak valid'
        })
      }

      const p = promoCheck[0]

      if (!p.is_active) {
        return NextResponse.json({
          success: false,
          message: 'Kode promo tidak aktif'
        })
      }

      if (p.start_date && new Date(p.start_date) > new Date()) {
        return NextResponse.json({
          success: false,
          message: 'Kode promo belum aktif'
        })
      }

      if (p.end_date && new Date(p.end_date) <= new Date()) {
        return NextResponse.json({
          success: false,
          message: 'Kode promo sudah kadaluarsa'
        })
      }

      // If we get here, it's a quota issue
      return NextResponse.json({
        success: false,
        message: 'Kuota kode promo sudah habis. Hubungi admin @Risxyiee di Telegram untuk request reset.'
      })
    }

    const promo = promoResult[0]

    // Check if user already has an active subscription with this promo code
    const existingSub: any[] = await db.$queryRawUnsafe(`
      SELECT id FROM user_subscriptions
      WHERE user_id = $1 AND promo_code_id = $2 AND status = 'active'
      LIMIT 1;
    `, userId, promo.id)

    if (existingSub && existingSub.length > 0) {
      // Decrement quota back since user already used this promo
      await db.$executeRawUnsafe(`
        UPDATE promo_codes SET used_quota = used_quota - 1, updated_at = NOW() WHERE id = $1;
      `, promo.id)
      return NextResponse.json({
        success: false,
        message: 'Anda sudah menggunakan kode promo ini sebelumnya'
      })
    }

    // Calculate end date based on duration months
    const startDate = new Date()
    const months = promo.duration_months || 3
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)

    // Create new subscription with raw SQL
    const subscriptionId = randomUUID()
    await db.$executeRawUnsafe(`
      INSERT INTO user_subscriptions (id, user_id, plan, status, start_date, end_date, promo_code_id, discount_percent, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', NOW(), $4, $5, $6, NOW(), NOW());
    `, subscriptionId, userId, plan, endDate, promo.id, promo.discount_percent)

    // Update user profile to Pro
    await db.$executeRawUnsafe(`
      UPDATE profiles SET
        plan = 'PRO',
        is_pro = true,
        subscription_until = $1,
        pro_expiry = $1,
        updated_at = NOW()
      WHERE id = $2;
    `, endDate, userId)

    // Also update Supabase Auth user_metadata to keep admin panel in sync
    try {
      const { supabaseAdmin: adminClient } = await import('@/lib/supabase-admin-alt')
      if (adminClient) {
        const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(userId)
        const currentMeta = authUser?.user_metadata || {}
        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...currentMeta,
            is_pro: true,
            subscription_status: 'active',
            subscription_until: endDate.toISOString(),
            has_ever_been_pro: true,
            updated_at: new Date().toISOString()
          }
        })
      }
    } catch (_syncErr) {
      // non-critical — Prisma/DB is source of truth
    }

    const remainingQuota = Number(promo.max_quota) - Number(promo.used_quota)

    // Auto-deactivate promo when quota is fully used
    if (remainingQuota <= 0) {
      try {
        await db.$executeRawUnsafe(`
          UPDATE promo_codes SET is_active = false, updated_at = NOW() WHERE id = $1;
        `, promo.id)
        console.log(`🔒 [promo/apply] Promo ${promo.code} auto-deactivated — quota penuh (${promo.used_quota}/${promo.max_quota})`)
      } catch {
        // non-critical
      }
    }

    return NextResponse.json({
      success: true,
      message: `Kode promo berhasil diterapkan! Anda mendapatkan akses ${plan} selama ${months} bulan.`,
      subscription: {
        id: subscriptionId,
        plan,
        status: 'active',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        discountPercent: Number(promo.discount_percent)
      },
      promoCode: {
        code: promo.code,
        remainingQuota
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Gagal menerapkan kode promo' },
      { status: 500 }
    )
  }
}