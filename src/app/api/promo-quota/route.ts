import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed).
 * Uses Supabase client directly — no Prisma (avoids connection pool exhaustion).
 * Memory-cached for 60s to avoid DB hit on every landing page visit.
 */

const DEFAULT_PROMO = {
  code: 'TRADERCEPAT', maxQuota: 30, usedQuota: 30, remainingQuota: 0,
  discountPercent: 100, durationMonths: 3, isActive: false
}

// In-memory cache
let cache: { data: typeof DEFAULT_PROMO; code: string; expiry: number } | null = null
const CACHE_TTL = 60_000 // 60 seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    // Return cached data if still fresh and same code
    if (cache && cache.code === code && Date.now() < cache.expiry) {
      return NextResponse.json(cache.data)
    }

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json(DEFAULT_PROMO)
    }

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

    const result = {
      code: promo.code,
      maxQuota,
      usedQuota,
      remainingQuota: Math.max(0, maxQuota - usedQuota),
      discountPercent: Number(promo.discount_percent) || 100,
      durationMonths: Number(promo.duration_months) || 3,
      isActive: promo.is_active,
    }

    cache = { data: result, code, expiry: Date.now() + CACHE_TTL }

    return NextResponse.json(result)
  } catch (err) {
    console.warn('[promo-quota] Error:', err)
    return NextResponse.json(DEFAULT_PROMO)
  }
}
