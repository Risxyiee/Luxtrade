import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'

/**
 * Validate promo code
 * POST /api/promo/validate
 * Body: { code: string }
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

    // Find promo code in database
    const promoCode = await db.promoCode.findUnique({
      where: { code: normalizedCode }
    })

    // Check if promo code exists
    if (!promoCode) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo tidak valid'
      })
    }

    // Check if promo code is active
    if (!promoCode.isActive) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo tidak aktif'
      })
    }

    // Check if promo code has expired
    const now = new Date()
    if (promoCode.endDate && now > promoCode.endDate) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo sudah kadaluarsa'
      })
    }

    // Check if promo code has started
    if (now < promoCode.startDate) {
      return NextResponse.json({
        valid: false,
        message: 'Kode promo belum aktif'
      })
    }

    // Check if quota is available
    if (promoCode.usedQuota >= promoCode.maxQuota) {
      return NextResponse.json({
        valid: false,
        message: 'Kuota kode promo sudah habis'
      })
    }

    // All checks passed - promo code is valid
    const remainingQuota = promoCode.maxQuota - promoCode.usedQuota

    return NextResponse.json({
      valid: true,
      promoCode: {
        code: promoCode.code,
        description: promoCode.description,
        discountPercent: promoCode.discountPercent,
        durationMonths: promoCode.durationMonths,
        remainingQuota,
        totalQuota: promoCode.maxQuota
      }
    })
  } catch (error) {
    console.error('❌ [Validate Promo Code] Error:', error)
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
    const promoCodes = await db.promoCode.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      promoCodes: promoCodes.map(pc => ({
        id: pc.id,
        code: pc.code,
        description: pc.description,
        discountPercent: pc.discountPercent,
        maxQuota: pc.maxQuota,
        usedQuota: pc.usedQuota,
        remainingQuota: pc.maxQuota - pc.usedQuota,
        durationMonths: pc.durationMonths,
        isActive: pc.isActive,
        startDate: pc.startDate,
        endDate: pc.endDate
      }))
    })
  } catch (error) {
    console.error('❌ [Get Promo Codes] Error:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil daftar kode promo' },
      { status: 500 }
    )
  }
}