import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Reset promo code quota (Admin only)
 * POST /api/promo/reset
 * Body: { code: string, maxQuota?: number, isActive?: boolean }
 */
const ADMIN_EMAILS = ['luxtradee@gmail.com']

export async function POST(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email')
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const body = await request.json()
    const { code, maxQuota, isActive } = body

    if (!code) {
      return NextResponse.json({ error: 'Kode promo wajib diisi' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    const promo = await db.promoCode.upsert({
      where: { code: normalizedCode },
      update: {
        ...(maxQuota !== undefined ? { maxQuota: parseInt(maxQuota) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        usedQuota: 0,
      },
      create: {
        code: normalizedCode,
        description: `Promo ${normalizedCode}`,
        discountPercent: 30,
        maxQuota: maxQuota ? parseInt(maxQuota) : 30,
        usedQuota: 0,
        durationMonths: 1,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Promo ${normalizedCode} berhasil direset`,
      promo: {
        code: promo.code,
        maxQuota: promo.maxQuota,
        usedQuota: promo.usedQuota,
        remainingQuota: promo.maxQuota - promo.usedQuota,
        discountPercent: promo.discountPercent,
        durationMonths: promo.durationMonths,
        isActive: promo.isActive,
      },
    })
  } catch (error: unknown) {
    console.error('❌ [Reset Promo] Error:', error)
    const msg = error instanceof Error ? error.message : 'Gagal reset promo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
