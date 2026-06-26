import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed)
 * Uses raw SQL to avoid Prisma caching stale values
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await ensureSchema()

    if (!isDatabaseAvailable()) {
      return NextResponse.json({
        code: 'TRADERCEPAT',
        maxQuota: 0,
        usedQuota: 0,
        remainingQuota: 0,
        discountPercent: 0,
        durationMonths: 0,
        isActive: false,
        offline: true
      })
    }

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT id, code, description, discount_percent, max_quota, used_quota, duration_months, is_active
       FROM promo_codes WHERE code = $1`,
      code
    )

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    const promo = rows[0]

    return NextResponse.json({
      code: promo.code,
      maxQuota: Number(promo.max_quota),
      usedQuota: Number(promo.used_quota),
      remainingQuota: Number(promo.max_quota) - Number(promo.used_quota),
      discountPercent: Number(promo.discount_percent),
      durationMonths: Number(promo.duration_months),
      isActive: promo.is_active
    })
  } catch (error: any) {
    console.error('[promo-quota] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}