import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/pro-promo-log
 *
 * Returns:
 * 1. All promo codes with current quota (realtime)
 * 2. All PRO users who used promo codes — who, when, which code, status
 * 3. All PRO users total count
 *
 * IMPORTANT: Does NOT auto-create tables anymore. If tables don't exist,
 * returns clear error telling admin to run db-sync. This prevents silent
 * failures where auto-created empty tables hide the real data.
 */
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

    // ── 0. Verify tables exist (fail fast with clear message) ──
    let tablesExist = false
    try {
      const tableCheck: any[] = await db.$queryRawUnsafe(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN ('promo_codes', 'user_subscriptions')
        ORDER BY tablename
      `)
      const foundTables = (tableCheck || []).map((r: any) => r.tablename)
      tablesExist = foundTables.includes('promo_codes') && foundTables.includes('user_subscriptions')

      if (!tablesExist) {
        const missing = []
        if (!foundTables.includes('promo_codes')) missing.push('promo_codes')
        if (!foundTables.includes('user_subscriptions')) missing.push('user_subscriptions')
        console.error(`[pro-promo-log] MISSING TABLES: ${missing.join(', ')}`)
        return NextResponse.json({
          error: `Tabel ${missing.join(', ')} tidak ada di database. Jalankan /api/admin/db-sync terlebih dahulu, atau buat tabel manual di Supabase SQL Editor.`,
          missingTables: missing,
          hint: 'POST /api/admin/db-sync untuk auto-create tabel.'
        }, { status: 500 })
      }
    } catch (checkErr: any) {
      console.error('[pro-promo-log] Table existence check failed:', checkErr.message)
      // If we can't even check tables, try the queries anyway (might be SQLite local)
    }

    // ── 1. Fetch all promo codes with quota ──
    const promoRows: any[] = await db.$queryRawUnsafe(`
      SELECT id, code, description, discount_percent, max_quota, used_quota,
             duration_months, is_active, start_date, end_date, created_at
      FROM promo_codes
      ORDER BY created_at DESC
    `)

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
    } catch (subErr: any) {
      console.error('[pro-promo-log] user_subscriptions query failed:', subErr.message?.substring(0, 120))
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

    // ── 5. Also count from profiles table (cross-check for PRO users from promo) ──
    // This catches users who are PRO but don't have user_subscriptions record
    let proUsersFromProfiles: any[] = []
    try {
      proUsersFromProfiles = await db.$queryRawUnsafe(`
        SELECT id, email, full_name, is_pro, plan, subscription_until, pro_expiry, created_at
        FROM profiles
        WHERE is_pro = true
        ORDER BY subscription_until DESC
        LIMIT 50
      `)
    } catch {}

    const data = {
      promoCodes: promoList,
      promoUsage,
      totalProUsers,
      promoActiveUsers: promoActiveUsers.length,
      promoExpiredUsers: promoExpiredUsers.length,
      totalPromoUsage: promoUsage.length,
      proUsersFromProfiles: proUsersFromProfiles.map((p: any) => ({
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        isPro: p.is_pro,
        plan: p.plan,
        subscriptionUntil: p.subscription_until,
        proExpiry: p.pro_expiry,
        createdAt: p.created_at,
      })),
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

/**
 * POST /api/admin/pro-promo-log
 * Create a new promo code. Admin only.
 * Body: { code, discountPercent?, maxQuota?, durationMonths?, endDate? }
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    // Ensure tables exist
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS promo_codes (
        id TEXT PRIMARY KEY, code TEXT NOT NULL, description TEXT,
        discount_percent DOUBLE PRECISION NOT NULL, max_quota INTEGER NOT NULL,
        used_quota INTEGER NOT NULL DEFAULT 0, duration_months INTEGER NOT NULL,
        start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), end_date TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`)
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), end_date TIMESTAMPTZ,
        promo_code_id TEXT, discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`)
    } catch {}

    const body = await request.json()
    const code = (body.code || '').trim().toUpperCase()
    const discountPercent = body.discountPercent ?? 100
    const maxQuota = body.maxQuota ?? 30
    const durationMonths = body.durationMonths ?? 3
    const description = body.description || null
    const endDate = body.endDate ? new Date(body.endDate) : null

    if (!code || code.length < 3) {
      return NextResponse.json({ error: 'Kode promo minimal 3 karakter' }, { status: 400 })
    }

    // Check duplicate
    const existing: any[] = await db.$queryRawUnsafe(`
      SELECT id FROM promo_codes WHERE code = $1 LIMIT 1
    `, code)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: `Kode promo "${code}" sudah ada` }, { status: 409 })
    }

    await db.$executeRawUnsafe(`
      INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, end_date, is_active, created_at, updated_at)
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, $5, NOW(), $6, true, NOW(), NOW())
    `, code, description, discountPercent, maxQuota, durationMonths, endDate || null)

    // Invalidate cache
    cache = null

    return NextResponse.json({
      success: true,
      message: `Promo code "${code}" berhasil dibuat!`,
      promoCode: { code, discountPercent, maxQuota, durationMonths }
    })
  } catch (err: any) {
    console.error('[pro-promo-log] POST error:', err)
    return NextResponse.json({ error: 'Gagal membuat promo code', details: err.message }, { status: 500 })
  }
}

/**
 * PUT /api/admin/pro-promo-log
 * Update a promo code: toggle active, edit quota, reset quota, etc. Admin only.
 * Body: { id, action: 'toggle' | 'updateQuota' | 'resetQuota' | 'edit', ...fields }
 */
export async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'id dan action diperlukan' }, { status: 400 })
    }

    // Verify promo exists
    const existing: any[] = await db.$queryRawUnsafe(`
      SELECT id, code, is_active, used_quota, max_quota FROM promo_codes WHERE id = $1 LIMIT 1
    `, id)

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Promo code tidak ditemukan' }, { status: 404 })
    }

    const promo = existing[0]

    if (action === 'toggle') {
      // Toggle active/inactive
      const newActive = !promo.is_active
      await db.$executeRawUnsafe(`
        UPDATE promo_codes SET is_active = $1, updated_at = NOW() WHERE id = $2
      `, newActive, id)
      cache = null
      return NextResponse.json({
        success: true,
        message: `Promo "${promo.code}" ${newActive ? 'diaktifkan' : 'dinonaktifkan'}`,
        isActive: newActive
      })
    }

    if (action === 'updateQuota') {
      const newMaxQuota = body.maxQuota
      if (!newMaxQuota || newMaxQuota < 1) {
        return NextResponse.json({ error: 'Max quota minimal 1' }, { status: 400 })
      }
      await db.$executeRawUnsafe(`
        UPDATE promo_codes SET max_quota = $1, updated_at = NOW() WHERE id = $2
      `, newMaxQuota, id)
      cache = null
      return NextResponse.json({
        success: true,
        message: `Kuota promo "${promo.code}" diubah ke ${newMaxQuota}`
      })
    }

    if (action === 'resetQuota') {
      // Reset used_quota to 0, reactivate
      await db.$executeRawUnsafe(`
        UPDATE promo_codes SET used_quota = 0, is_active = true, updated_at = NOW() WHERE id = $1
      `, id)
      cache = null
      return NextResponse.json({
        success: true,
        message: `Kuota promo "${promo.code}" berhasil direset. Status: Aktif.`
      })
    }

    if (action === 'edit') {
      // Edit multiple fields
      const updates: string[] = []
      const values: any[] = []
      let paramIdx = 2 // $1 = id

      if (body.description !== undefined) {
        updates.push(`description = $${paramIdx++}`)
        values.push(body.description || null)
      }
      if (body.durationMonths !== undefined && body.durationMonths >= 1) {
        updates.push(`duration_months = $${paramIdx++}`)
        values.push(body.durationMonths)
      }
      if (body.endDate !== undefined) {
        updates.push(`end_date = $${paramIdx++}`)
        values.push(body.endDate ? new Date(body.endDate) : null)
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'Tidak ada field yang diubah' }, { status: 400 })
      }

      updates.push(`updated_at = NOW()`)
      await db.$executeRawUnsafe(`
        UPDATE promo_codes SET ${updates.join(', ')} WHERE id = $1
      `, id, ...values)
      cache = null
      return NextResponse.json({
        success: true,
        message: `Promo "${promo.code}" berhasil diupdate`
      })
    }

    return NextResponse.json({ error: `Action "${action}" tidak dikenali` }, { status: 400 })
  } catch (err: any) {
    console.error('[pro-promo-log] PUT error:', err)
    return NextResponse.json({ error: 'Gagal update promo code', details: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/pro-promo-log
 * Delete a promo code. Admin only.
 * Query params: ?id=<promo_id>
 * 
 * NOTE: Deleting a promo code does NOT revoke PRO status from users who already claimed it.
 * Those users keep their PRO access until their subscription expires.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id diperlukan (query param)' }, { status: 400 })
    }

    // Get promo info before deleting
    const existing: any[] = await db.$queryRawUnsafe(`
      SELECT id, code, used_quota FROM promo_codes WHERE id = $1 LIMIT 1
    `, id)

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Promo code tidak ditemukan' }, { status: 404 })
    }

    const promo = existing[0]

    // Delete promo code (user_subscriptions records are kept for history)
    await db.$executeRawUnsafe(`DELETE FROM promo_codes WHERE id = $1`, id)
    cache = null

    return NextResponse.json({
      success: true,
      message: `Promo code "${promo.code}" berhasil dihapus. ${promo.used_quota} user yang sudah claim tetap PRO sampai masa berlangganan habis.`,
      deletedCode: promo.code,
      affectedUsers: promo.used_quota
    })
  } catch (err: any) {
    console.error('[pro-promo-log] DELETE error:', err)
    return NextResponse.json({ error: 'Gagal menghapus promo code', details: err.message }, { status: 500 })
  }
}
