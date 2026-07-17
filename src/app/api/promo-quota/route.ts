import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed).
 * Optimized: single query, no table-existence check.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_PROMO = {
  code: 'TRADERCEPAT', maxQuota: 30, usedQuota: 30, remainingQuota: 0,
  discountPercent: 100, durationMonths: 3, isActive: false
}

export async function GET(request: Request) {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json(DEFAULT_PROMO)
    }

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    // Single query — if table doesn't exist, catch and return defaults
    try {
      const promoRows: any[] = await db.$queryRawUnsafe(
        `SELECT code, discount_percent, max_quota, used_quota, duration_months, is_active
         FROM promo_codes WHERE code = $1`,
        code
      )

      if (!promoRows || promoRows.length === 0) {
        return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
      }

      const promo = promoRows[0]
      const usedQuota = Number(promo.used_quota)
      const maxQuota = Number(promo.max_quota)

      return NextResponse.json({
        code: promo.code, maxQuota, usedQuota,
        remainingQuota: Math.max(0, maxQuota - usedQuota),
        discountPercent: Number(promo.discount_percent) || 100,
        durationMonths: Number(promo.duration_months) || 3,
        isActive: promo.is_active
      })
    } catch (err) {
      console.warn('[promo-quota] Query failed:', err)
      return NextResponse.json(DEFAULT_PROMO)
    }
  } catch (err) {
    console.warn('[promo-quota] Outer catch:', err)
    return NextResponse.json(DEFAULT_PROMO)
  }
}