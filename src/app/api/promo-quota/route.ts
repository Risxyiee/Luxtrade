import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    if (!isDatabaseAvailable()) {
      // Return safe defaults when database is not available (local dev)
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
    const code = searchParams.get('code') || 'TRADERCEPAT'

    const promo = await db.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    })

    if (!promo) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    return NextResponse.json({
      code: promo.code,
      maxQuota: promo.maxQuota,
      usedQuota: promo.usedQuota,
      remainingQuota: promo.maxQuota - promo.usedQuota,
      discountPercent: promo.discountPercent,
      durationMonths: promo.durationMonths,
      isActive: promo.isActive
    })
  } catch (error: any) {
    console.error('[promo-quota] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
