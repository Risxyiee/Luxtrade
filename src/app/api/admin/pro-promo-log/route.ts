import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/pro-promo-log
 * Returns:
 * 1. All promo codes with current quota (realtime)
 * 2. All PRO users who used promo codes — who, when, which code, status
 * 3. All PRO users total count
 *
 * Uses Prisma $queryRaw (tagged template) to avoid schema cache issues.
 * Auto-creates missing tables (user_subscriptions, promo_codes) if they
 * don't exist in the database — this can happen after a fresh deploy
 * or if tables were accidentally dropped.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Short cache for burst requests (5s)
let cache: { data: any; expiry: number } | null = null
const CACHE_TTL = 5_000

/** Ensure promo-related tables exist, create if missing */
async function ensurePromoTables() {
  const ddl = [
    // promo_codes table
    `CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      description TEXT,
      discount_percent DOUBLE PRECISION NOT NULL,
      max_quota INTEGER NOT NULL,
      used_quota INTEGER NOT NULL DEFAULT 0,
      duration_months INTEGER NOT NULL,
      start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_date TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // user_subscriptions table
    `CREATE TABLE IF NOT EXISTS user_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_date TIMESTAMPTZ,
      promo_code_id TEXT,
      discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code)`,
    `CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, start_date, end_date)`,
    `CREATE INDEX IF NOT EXISTS idx_user_subs_user_id ON user_subscriptions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_subs_promo_id ON user_subscriptions(promo_code_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_subs_status ON user_subscriptions(status)`,
  ]
  for (const sql of ddl) {
    try { await db.$executeRawUnsafe(sql) } catch {}
  }
}

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

    // Ensure tables exist (safe — IF NOT EXISTS)
    await ensurePromoTables()

    // ── 1. Fetch all promo codes with quota ──
    let promoRows: any[] = []
    try {
      promoRows = await db.$queryRawUnsafe(`
        SELECT id, code, description, discount_percent, max_quota, used_quota,
               duration_months, is_active, start_date, end_date, created_at
        FROM promo_codes
        ORDER BY created_at DESC
      `)
    } catch (err: any) {
      console.error('[pro-promo-log] promo_codes query failed:', err.message?.substring(0, 100))
    }

    const promoList = (promoRows || []).map((p: any) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      discountPercent: Number(p.discount_percent),
      maxQuota: Number(p.max_quota),
      usedQuota: Number(p.used_quota),
      remainingQuota: Math.max(0, Number(p.max_quota || 0) - Number(p.used_quota || 0)),
      durationMonths: Number(p.duration_months),
      isActive: p.is_active,
      startDate: p.start_date,
      endDate: p.end_date,
      createdAt: p.created_at,
    }))

    // ── 2. Fetch promo-based subscriptions (users who used promo codes) ──
    let subRows: any[] = []
    try {
      subRows = await db.$queryRawUnsafe(`
        SELECT us.id, us.user_id, us.plan, us.status, us.start_date, us.end_date,
               us.discount_percent, us.promo_code_id, us.created_at,
               pc.code AS promo_code
        FROM user_subscriptions us
        LEFT JOIN promo_codes pc ON pc.id = us.promo_code_id
        WHERE us.promo_code_id IS NOT NULL
        ORDER BY us.created_at DESC
      `)
    } catch (err: any) {
      console.error('[pro-promo-log] user_subscriptions query failed:', err.message?.substring(0, 100))
    }

    // Get profile data for each user (batch)
    const userIds = [...new Set((subRows || []).map((s: any) => s.user_id))]
    let profileMap = new Map<string, any>()

    if (userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',')
      const profileRows: any[] = await db.$queryRawUnsafe(`
        SELECT id, email, full_name, is_pro, plan, subscription_until
        FROM profiles
        WHERE id IN (${placeholders})
      `, ...userIds)

      if (profileRows) {
        profileMap = new Map(profileRows.map((p: any) => [p.id, p]))
      }
    }

    const promoUsage = (subRows || []).map((sub: any) => {
      const profile = profileMap.get(sub.user_id)
      const now = new Date()
      const endDate = sub.end_date ? new Date(sub.end_date) : null
      const isExpired = endDate ? endDate < now : true

      return {
        id: sub.id,
        userId: sub.user_id,
        email: profile?.email || null,
        fullName: profile?.full_name || null,
        promoCode: sub.promo_code || 'Unknown',
        plan: sub.plan,
        status: sub.status,
        discountPercent: Number(sub.discount_percent),
        startDate: sub.start_date,
        endDate: sub.end_date,
        isCurrentlyActive: sub.status === 'active' && !isExpired,
        isExpired,
        createdAt: sub.created_at,
      }
    })

    // ── 3. Count all active PRO users ──
    let totalProUsers = 0
    try {
      const proCountResult: any[] = await db.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS total
        FROM profiles
        WHERE is_pro = true
          AND subscription_until IS NOT NULL
          AND subscription_until > NOW()
      `)
      totalProUsers = proCountResult?.[0]?.total || 0
    } catch {}

    // ── 4. Count promo-based active vs expired ──
    const promoActiveUsers = promoUsage.filter(u => u.isCurrentlyActive)
    const promoExpiredUsers = promoUsage.filter(u => u.isExpired && u.status === 'active')

    const data = {
      promoCodes: promoList,
      promoUsage,
      totalProUsers,
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
