import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'

/**
 * Create new promo code (Admin only)
 * POST /api/promo/create
 * Body: { code: string, description?: string, discountPercent: number, maxQuota: number, durationMonths: number, startDate?: string, endDate?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureSchema()
    const body = await request.json()
    const {
      code,
      description,
      discountPercent,
      maxQuota,
      durationMonths,
      startDate,
      endDate
    } = body

    // Validate required fields
    if (!code || !discountPercent || !maxQuota || !durationMonths) {
      return NextResponse.json(
        { error: 'code, discountPercent, maxQuota, and durationMonths are required' },
        { status: 400 }
      )
    }

    // Normalize code to uppercase
    const normalizedCode = code.trim().toUpperCase()

    // Check if promo code already exists
    const existingPromo = await db.promoCode.findUnique({
      where: { code: normalizedCode }
    })

    if (existingPromo) {
      return NextResponse.json({
        success: false,
        message: 'Kode promo sudah ada'
      })
    }

    // Create promo code
    const promoCode = await db.promoCode.create({
      data: {
        code: normalizedCode,
        description: description || null,
        discountPercent: parseFloat(discountPercent),
        maxQuota: parseInt(maxQuota),
        usedQuota: 0,
        durationMonths: parseInt(durationMonths),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Kode promo berhasil dibuat',
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        description: promoCode.description,
        discountPercent: promoCode.discountPercent,
        maxQuota: promoCode.maxQuota,
        usedQuota: promoCode.usedQuota,
        remainingQuota: promoCode.maxQuota - promoCode.usedQuota,
        durationMonths: promoCode.durationMonths,
        isActive: promoCode.isActive,
        startDate: promoCode.startDate,
        endDate: promoCode.endDate
      }
    })
  } catch (error) {
    console.error('❌ [Create Promo Code] Error:', error)
    return NextResponse.json(
      { error: 'Gagal membuat kode promo' },
      { status: 500 }
    )
  }
}