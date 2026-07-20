import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed).
 * Uses Supabase client directly — no Prisma (avoids connection pool exhaustion).
 */
export const dynamic = 'force-dynamic'

const DEFAULT_PROMO = {
  code: 'TRADERCEPAT', maxQuota: 30, usedQuota: 30, remainingQuota: 0,
  discountPercent: 100, durationMonths: 3, isActive: false
}

export async function GET(request: Request) {
  try {
    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json(DEFAULT_PROMO)
    }

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    const { data, error } = await svc
      .from('promo_codes')
      .select('code, discount_percent, max_quota, used_quota, duration_months, is_active')
      .eq('code', code)
      .limit(1)

    if (error || !data || data.length === 0) {
      console.warn('[promo-quota] Query failed or not found:', error?.message)
      return NextResponse.json(DEFAULT_PROMO)
    }

    const promo = data[0]
    const usedQuota = Number(promo.used_quota)
    const maxQuota = Number(promo.max_quota)

    return NextResponse.json({
      code: promo.code,
      maxQuota,
      usedQuota,
      remainingQuota: Math.max(0, maxQuota - usedQuota),
      discountPercent: Number(promo.discount_percent) || 100,
      durationMonths: Number(promo.duration_months) || 3,
      isActive: promo.is_active,
    })
  } catch (err) {
    console.warn('[promo-quota] Error:', err)
    return NextResponse.json(DEFAULT_PROMO)
  }
}