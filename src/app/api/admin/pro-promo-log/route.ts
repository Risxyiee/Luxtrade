import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/pro-promo-log
 * Returns:
 * 1. All promo codes with current quota (realtime)
 * 2. All PRO users who used promo codes — who, when, which code, status
 * 3. All PRO users total count
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Short cache for burst requests (5s)
let cache: { data: any; expiry: number } | null = null
const CACHE_TTL = 5_000

export async function GET(request: NextRequest) {
  try {
    // Admin auth check — consistent with all other /api/admin/* endpoints
    const { error: authError } = await requireAdmin(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }
    // Return cache if fresh
    if (cache && Date.now() < cache.expiry) {
      return NextResponse.json(cache.data)
    }

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    // ── 1. Fetch all promo codes with quota ──
    const { data: promoCodes, error: promoErr } = await svc
      .from('promo_codes')
      .select('id, code, discount_percent, max_quota, used_quota, duration_months, is_active, start_date, end_date, created_at')
      .order('created_at', { ascending: false })

    if (promoErr) {
      console.error('[pro-promo-log] promo_codes query error:', promoErr.message)
    }

    const promoList = (promoCodes || []).map((p: any) => ({
      id: p.id,
      code: p.code,
      discountPercent: p.discount_percent,
      maxQuota: p.max_quota,
      usedQuota: p.used_quota,
      remainingQuota: Math.max(0, (p.max_quota || 0) - (p.used_quota || 0)),
      durationMonths: p.duration_months,
      isActive: p.is_active,
      startDate: p.start_date,
      endDate: p.end_date,
      createdAt: p.created_at,
    }))

    // ── 2. Fetch promo-based subscriptions (users who used promo codes) ──
    const { data: promoSubs, error: subErr } = await svc
      .from('user_subscriptions')
      .select(`
        id, user_id, plan, status, start_date, end_date,
        discount_percent, promo_code_id, created_at,
        promo_codes(code)
      `)
      .not('promo_code_id', 'is', null)
      .order('created_at', { ascending: false })

    if (subErr) {
      console.error('[pro-promo-log] user_subscriptions query error:', subErr.message)
    }

    // Get profile data for each user
    const userIds = [...new Set((promoSubs || []).map((s: any) => s.user_id))]
    let profileMap = new Map<string, any>()

    if (userIds.length > 0) {
      const { data: profiles } = await svc
        .from('profiles')
        .select('id, email, full_name, is_pro, plan, subscription_until')
        .in('id', userIds)
      
      if (profiles) {
        profileMap = new Map(profiles.map((p: any) => [p.id, p]))
      }
    }

    const promoUsage = (promoSubs || []).map((sub: any) => {
      const profile = profileMap.get(sub.user_id)
      const now = new Date()
      const endDate = sub.end_date ? new Date(sub.end_date) : null
      const isExpired = endDate ? endDate < now : true

      return {
        id: sub.id,
        userId: sub.user_id,
        email: profile?.email || null,
        fullName: profile?.full_name || null,
        promoCode: sub.promo_codes?.code || 'Unknown',
        plan: sub.plan,
        status: sub.status,
        discountPercent: sub.discount_percent,
        startDate: sub.start_date,
        endDate: sub.end_date,
        isCurrentlyActive: sub.status === 'active' && !isExpired,
        isExpired,
        createdAt: sub.created_at,
      }
    })

    // ── 3. Count all PRO users ──
    const { count: totalProUsers } = await svc
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_pro', true)
      .gte('subscription_until', new Date().toISOString())

    // ── 4. Count promo-based active PRO users ──
    const promoActiveUsers = promoUsage.filter(u => u.isCurrentlyActive)
    const promoExpiredUsers = promoUsage.filter(u => u.isExpired && u.status === 'active')

    const data = {
      promoCodes: promoList,
      promoUsage,
      totalProUsers: totalProUsers || 0,
      promoActiveUsers: promoActiveUsers.length,
      promoExpiredUsers: promoExpiredUsers.length,
      totalPromoUsage: promoUsage.length,
      summary: {
        totalPromoCodes: promoList.length,
        activePromoCodes: promoList.filter(p => p.isActive).length,
        totalQuotaUsed: promoList.reduce((s: number, p: any) => s + p.usedQuota, 0),
        totalQuotaRemaining: promoList.reduce((s: number, p: any) => s + p.remainingQuota, 0),
      },
    }

    cache = { data, expiry: Date.now() + CACHE_TTL }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-cache, no-store' }, // Always fresh for admin
    })
  } catch (err) {
    console.error('[pro-promo-log] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
