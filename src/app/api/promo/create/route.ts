import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db, ensureSchema } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * Create new promo code (Admin only)
 * POST /api/promo/create
 * Body: { code: string, description?: string, discountPercent: number, maxQuota: number, durationMonths: number, startDate?: string, endDate?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureSchema()
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const profile = await db.profile.findUnique({ where: { id: authUser.id }, select: { role: true } })
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

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
    const existing: any[] = await db.$queryRawUnsafe(`
      SELECT id FROM promo_codes WHERE code = $1 LIMIT 1;
    `, normalizedCode)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Kode promo sudah ada'
      })
    }

    // Create promo code
    await db.$executeRawUnsafe(`
      INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, end_date, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, true, NOW(), NOW());
    `, randomUUID(), normalizedCode, description || null, parseFloat(discountPercent), parseInt(maxQuota), parseInt(durationMonths), startDate ? new Date(startDate) : new Date(), endDate ? new Date(endDate) : null)

    return NextResponse.json({
      success: true,
      message: 'Kode promo berhasil dibuat'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Gagal membuat kode promo' },
      { status: 500 }
    )
  }
}