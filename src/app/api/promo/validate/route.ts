import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'

/**
 * Validate promo code
 * POST /api/promo/validate
 * Body: { code: string }
 *
 * Uses raw SQL to read real-time quota values directly from DB.
 * Avoids Prisma ORM caching which could return stale used_quota.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureSchema()
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Promo code is required' },
        { status: 400 }
      )
    }

    // Normalize code to uppercase
    const normalizedCode = code.trim().toUpperCase()

    // Query promo code directly from DB (no ORM caching)
    const results: any[] = await db.$queryRawUnsafe(`
      SELECT code, description, discount_percent, max_quota, used_quota, duration_months,
             start_date, end_date, is_active
      FROM promo_codes
      WHERE code = $1
      LIMIT 1;
    `, normalizedCode)

    if (!results || results.length === 0) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo tidak valid'
      })
    }

    const promo = results[0]

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
        message: 'Kuota kode promo sudah habis'
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
    await ensureSchema()
    const results: any[] = await db.$queryRawUnsafe(`
      SELECT id, code, description, discount_percent, max_quota, used_quota,
             duration_months, start_date, end_date, is_active, created_at
      FROM promo_codes
      ORDER BY created_at DESC;
    `)

    const promoCodes = (results || []).map((pc: any) => ({
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

    return NextResponse.json({ promoCodes })
  } catch (error) {
    return NextResponse.json(
      { error: 'Gagal mengambil daftar kode promo' },
      { status: 500 }
    )
  }
}