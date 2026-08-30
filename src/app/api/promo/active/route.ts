export const runtime = 'edge'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * GET /api/promo/active
 *
 * Returns the FIRST ACTIVE promo code from the database.
 * Used by the landing page to display the current promo code dynamically.
 *
 * No auth needed — this is a public endpoint for the landing page.
 * Cached for 60 seconds to avoid DB hit on every visit.
 *
 * Response:
 *   { code, maxQuota, usedQuota, remainingQuota, discountPercent, durationMonths, isActive }
 *   or { code: null, ... } if no active promo exists
 */

const EMPTY_PROMO = {
  code: null as string | null,
  maxQuota: 0,
  usedQuota: 0,
  remainingQuota: 0,
  discountPercent: 100,
  durationMonths: 3,
  isActive: false,
}

let cache: { data: typeof EMPTY_PROMO; expiry: number } | null = null
const CACHE_TTL = 60_000 // 60 seconds

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Return cached data if fresh
    if (cache && Date.now() < cache.expiry) {
      return NextResponse.json(cache.data)
    }

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json(EMPTY_PROMO)
    }

    // Fetch the first active promo code with remaining quota
    const { data, error } = await svc
      .from('promo_codes')
      .select('code, discount_percent, max_quota, used_quota, duration_months, is_active')
      .eq('is_active', true)
      .gt('max_quota', 0) // has quota
      .order('created_at', { ascending: true })
      .limit(1)

    if (error || !data || data.length === 0) {
      // No active promo — check if there are ANY promo codes (even inactive)
      const { data: allPromos } = await svc
        .from('promo_codes')
        .select('code, discount_percent, max_quota, used_quota, duration_months, is_active')
        .order('created_at', { ascending: false })
        .limit(1)

      if (allPromos && allPromos.length > 0) {
        const promo = allPromos[0]
        const result = {
          code: promo.code,
          maxQuota: Number(promo.max_quota),
          usedQuota: Number(promo.used_quota),
          remainingQuota: Math.max(0, Number(promo.max_quota) - Number(promo.used_quota)),
          discountPercent: Number(promo.discount_percent) || 100,
          durationMonths: Number(promo.duration_months) || 3,
          isActive: promo.is_active,
        }
        cache = { data: result, expiry: Date.now() + CACHE_TTL }
        return NextResponse.json(result)
      }

      // No promo codes at all
      cache = { data: EMPTY_PROMO, expiry: Date.now() + CACHE_TTL }
      return NextResponse.json(EMPTY_PROMO)
    }

    const promo = data[0]
    const usedQuota = Number(promo.used_quota)
    const maxQuota = Number(promo.max_quota)

    const result = {
      code: promo.code,
      maxQuota,
      usedQuota,
      remainingQuota: Math.max(0, maxQuota - usedQuota),
      discountPercent: Number(promo.discount_percent) || 100,
      durationMonths: Number(promo.duration_months) || 3,
      isActive: promo.is_active,
    }

    cache = { data: result, expiry: Date.now() + CACHE_TTL }

    return NextResponse.json(result)
  } catch (err) {
    console.warn('[promo/active] Error:', err)
    return NextResponse.json(EMPTY_PROMO)
  }
}
