import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * Validate promo code
 * POST /api/promo/validate
 * Body: { code: string }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Promo code is required' },
        { status: 400 }
      )
    }

    // Normalize code to uppercase
    const normalizedCode = code.trim().toUpperCase()

    // Query promo code
    const { data: promo, error } = await admin.from('promo_codes')
      .select('code, description, discount_percent, max_quota, used_quota, duration_months, start_date, end_date, is_active')
      .eq('code', normalizedCode)
      .maybeSingle()

    if (error || !promo) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo tidak valid'
      })
    }

    // Check if active
    if (!promo.is_active) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo tidak aktif'
      })
    }

    // Check if expired
    const now = new Date()
    if (promo.end_date && now > new Date(promo.end_date)) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo sudah kadaluarsa'
      })
    }

    // Check if not yet started
    if (new Date(promo.start_date) > now) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo belum aktif'
      })
    }

    // Check quota availability
    const usedQuota = Number(promo.used_quota)
    const maxQuota = Number(promo.max_quota)

    if (usedQuota >= maxQuota) {
      return NextResponse.json({
        valid: false,
        message: 'Kuota kode promo sudah habis. Hubungi admin di Discord LuxTrade Server untuk request reset.'
      })
    }

    // All checks passed — promo code is valid
    const remainingQuota = maxQuota - usedQuota

    return NextResponse.json({
      valid: true,
      promoCode: {
        code: promo.code,
        description: promo.description,
        discountPercent: Number(promo.discount_percent),
        durationMonths: Number(promo.duration_months),
        remainingQuota,
        totalQuota: maxQuota
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Gagal memvalidasi kode promo' },
      { status: 500 }
    )
  }
}

/**
 * Get all promo codes (admin only)
 * GET /api/promo/validate
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // SECURITY: Require admin authentication
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

    const { data: promoCodes, error } = await admin.from('promo_codes')
      .select('id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, end_date, is_active, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Gagal mengambil daftar kode promo' }, { status: 500 })
    }

    const formatted = (promoCodes || []).map((pc: any) => ({
      id: pc.id,
      code: pc.code,
      description: pc.description,
      discountPercent: Number(pc.discount_percent),
      maxQuota: Number(pc.max_quota),
      usedQuota: Number(pc.used_quota),
      remainingQuota: Number(pc.max_quota) - Number(pc.used_quota),
      durationMonths: Number(pc.duration_months),
      isActive: pc.is_active,
      startDate: pc.start_date,
      endDate: pc.end_date
    }))

    return NextResponse.json({ promoCodes: formatted })
  } catch (error) {
    return NextResponse.json(
      { error: 'Gagal mengambil daftar kode promo' },
      { status: 500 }
    )
  }
}