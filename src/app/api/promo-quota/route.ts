import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_PROMO = {
  code: 'TRADERCEPAT', maxQuota: 30, usedQuota: 0, remainingQuota: 30,
  discountPercent: 100, durationMonths: 3, isActive: true
}

export async function GET(request: Request) {
  const logId = Math.random().toString(36).substring(2, 8)
  console.log(`📊 [promo-quota:${logId}] START`)

  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json(DEFAULT_PROMO)
    }

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    // Try query — table might not exist yet, that's fine
    let rows: any[]
    try {
      rows = await db.$queryRawUnsafe(
        `SELECT id, code, description, discount_percent, max_quota, used_quota, duration_months, is_active
         FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promo_codes'`
      )
    } catch {
      return NextResponse.json(DEFAULT_PROMO)
    }

    // Table doesn't exist — return defaults silently
    if (!rows || rows.length === 0) {
      console.log(`📊 [promo-quota:${logId}] Table doesn't exist, returning defaults`)
      return NextResponse.json(DEFAULT_PROMO)
    }

    // Query the actual promo
    try {
      const promoRows: any[] = await db.$queryRawUnsafe(
        `SELECT code, description, discount_percent, max_quota, used_quota, duration_months, is_active
         FROM promo_codes WHERE code = $1`,
        code
      )

      if (!promoRows || promoRows.length === 0) {
        console.error(`❌ [promo-quota:${logId}] Promo ${code} not found`)
        return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
      }

      const promo = promoRows[0]
      const usedQuota = Number(promo.used_quota)
      const maxQuota = Number(promo.max_quota)

      console.log(`📊 [promo-quota:${logId}] used=${usedQuota}, max=${maxQuota}, active=${promo.is_active}`)

      return NextResponse.json({
        code: promo.code, maxQuota, usedQuota,
        remainingQuota: Math.max(0, maxQuota - usedQuota),
        discountPercent: Number(promo.discount_percent) || 100,
        durationMonths: Number(promo.duration_months) || 3,
        isActive: promo.is_active
      })
    } catch (queryErr: any) {
      // Query failed — return defaults instead of erroring
      console.warn(`⚠️ [promo-quota:${logId}] Query failed: ${queryErr?.message}, returning defaults`)
      return NextResponse.json(DEFAULT_PROMO)
    }
  } catch (error: any) {
    console.error(`💥 [promo-quota:${logId}] FATAL:`, error?.message)
    return NextResponse.json(DEFAULT_PROMO)
  }
}