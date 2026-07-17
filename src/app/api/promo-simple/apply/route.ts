import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'

// Simple promo apply - no middleware, no edge runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', hint: 'Send { "promoCode": "TRADERCEPAT", "plan": "PRO" }' },
        { status: 400 }
      )
    }

    const code = body.promoCode || body.promo_code || body.code
    const plan = body.plan || 'PRO'

    if (!code) {
      return NextResponse.json(
        { error: 'promoCode is required' },
        { status: 400 }
      )
    }

    // Get user from session
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    const userId = user.id
    const normalizedCode = code.trim().toUpperCase()

    // ════════════════════════════════════════════════════════
    // ATOMIC claim — same pattern as /api/promo/apply
    // Prevents race condition: concurrent requests can't both claim
    // ════════════════════════════════════════════════════════
    const promoRows: any[] = await db.$queryRawUnsafe(`
      UPDATE promo_codes
      SET used_quota = used_quota + 1, updated_at = NOW()
      WHERE code = $1
        AND is_active = true
        AND (end_date IS NULL OR end_date > NOW())
        AND start_date <= NOW()
        AND used_quota < max_quota
      RETURNING id, code, discount_percent, max_quota, used_quota, duration_months;
    `, normalizedCode)

    if (!promoRows || promoRows.length === 0) {
      return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis' })
    }

    const promo = promoRows[0]

    // Check duplicate using raw SQL (same connection context)
    const existingSub: any[] = await db.$queryRawUnsafe(`
      SELECT id FROM user_subscriptions WHERE user_id = $1 AND promo_code_id = $2 AND status = 'active' LIMIT 1;
    `, userId, promo.id)

    if (existingSub && existingSub.length > 0) {
      // Rollback quota
      await db.$executeRawUnsafe(`UPDATE promo_codes SET used_quota = used_quota - 1 WHERE id = $1;`, promo.id)
      return NextResponse.json({ success: false, message: 'Anda sudah menggunakan kode promo ini' })
    }

    // Create subscription
    const startDate = new Date()
    const months = promo.duration_months || 3
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)

    await db.$executeRawUnsafe(`
      INSERT INTO user_subscriptions (id, user_id, plan, status, start_date, end_date, promo_code_id, discount_percent, created_at, updated_at)
      VALUES (gen_random_uuid()::text, $1, $2, 'active', NOW(), $3, $4, $5, NOW(), NOW());
    `, userId, plan, endDate, promo.id, promo.discount_percent)

    // Update profile
    try {
      await db.profile.update({
        where: { id: userId },
        data: {
          plan: 'PRO',
          is_pro: true,
          subscription_until: endDate,
          proExpiry: endDate
        }
      })
    } catch (e: any) {
      console.warn('⚠️ [Simple Promo] Could not update profile:', e.message)
    }

    const remainingQuota = Number(promo.max_quota) - Number(promo.used_quota)

    // Auto-deactivate when full
    if (remainingQuota <= 0) {
      try { await db.$executeRawUnsafe(`UPDATE promo_codes SET is_active = false WHERE id = $1;`, promo.id) } catch { /* ok */ }
    }

    return NextResponse.json({
      success: true,
      message: `Kode promo berhasil! Anda mendapatkan akses ${plan} selama ${months} bulan.`,
      promoCode: {
        code: promo.code,
        remainingQuota
      }
    })
  } catch (error: any) {
    console.error('❌ [Simple Promo] Error:', error)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    )
  }
}