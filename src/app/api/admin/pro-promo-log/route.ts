import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
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
    if (authError) return authError
    // Return cache if fresh
    if (cache && Date.now() < cache.expiry) {
      return NextResponse.json(cache.data)
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    // ── 1. Fetch all promo codes with quota ──
    const { data: promoRows, error: promoErr } = await admin
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })

    if (promoErr) {
      console.error('[pro-promo-log] promo_codes query failed:', promoErr.message)
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
      const { data: subData, error: subErr } = await admin
        .from('user_subscriptions')
        .select(`
          id, user_id, plan, status, start_date, end_date,
          discount_percent, promo_code_id, created_at,
          promo_code:promo_codes ( code )
        `)
        .not('promo_code_id', 'is', null)
        .order('created_at', { ascending: false })

      if (!subErr && subData) {
        subRows = subData.map((s: any) => ({
          ...s,
          promo_code: s.promo_code?.code || 'Unknown',
        }))
      }
    } catch (subErr: any) {
      console.error('[pro-promo-log] user_subscriptions query failed:', subErr.message?.substring(0, 120))
    }

    // Get profile data for each user (batch)
    const userIds = [...new Set((subRows || []).map((s: any) => s.user_id))]
    let profileMap = new Map<string, any>()

    if (userIds.length > 0) {
      // Supabase has a limit on `in` filter, so batch in groups of 100
      const batchSize = 100
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize)
        const { data: profileRows } = await admin
          .from('profiles')
          .select('id, email, full_name, is_pro, plan, subscription_until')
          .in('id', batch)

        if (profileRows) {
          profileRows.forEach((p: any) => profileMap.set(p.id, p))
        }
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
      const { count } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_pro', true)
        .not('subscription_until', 'is', null)
        .gt('subscription_until', new Date().toISOString())

      totalProUsers = count || 0
    } catch {}

    // ── 4. Count promo-based active vs expired ──
    const promoActiveUsers = promoUsage.filter(u => u.isCurrentlyActive)
    const promoExpiredUsers = promoUsage.filter(u => u.isExpired && u.status === 'active')

    // ── 5. Also count from profiles table (cross-check for PRO users from promo) ──
    let proUsersFromProfiles: any[] = []
    try {
      const { data: proData } = await admin
        .from('profiles')
        .select('id, email, full_name, is_pro, plan, subscription_until, pro_expiry, created_at')
        .eq('is_pro', true)
        .order('subscription_until', { ascending: false })
        .limit(50)

      if (proData) {
        proUsersFromProfiles = proData
      }
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
        activePromoCodes: promoList.filter((p: any) => p.isActive).length,
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
    if (authError) return authError

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

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
    const { data: existing, error: dupErr } = await admin
      .from('promo_codes')
      .select('id')
      .eq('code', code)
      .limit(1)

    if (dupErr) {
      console.error('[pro-promo-log] Duplicate check error:', dupErr.message)
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: `Kode promo "${code}" sudah ada` }, { status: 409 })
    }

    const { error: insertError } = await admin
      .from('promo_codes')
      .insert({
        code,
        description,
        discount_percent: discountPercent,
        max_quota: maxQuota,
        used_quota: 0,
        duration_months: durationMonths,
        start_date: new Date().toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('[pro-promo-log] Insert error:', insertError.message)
      return NextResponse.json({ error: 'Gagal membuat promo code', details: insertError.message }, { status: 500 })
    }

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
    if (authError) return authError

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'id dan action diperlukan' }, { status: 400 })
    }

    // Verify promo exists
    const { data: existingRows, error: fetchErr } = await admin
      .from('promo_codes')
      .select('id, code, is_active, used_quota, max_quota')
      .eq('id', id)
      .limit(1)

    if (fetchErr || !existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: 'Promo code tidak ditemukan' }, { status: 404 })
    }

    const promo = existingRows[0]

    if (action === 'toggle') {
      // Toggle active/inactive
      const newActive = !promo.is_active
      const { error: updateErr } = await admin
        .from('promo_codes')
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: 'Gagal update promo code', details: updateErr.message }, { status: 500 })
      }

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
      const { error: updateErr } = await admin
        .from('promo_codes')
        .update({ max_quota: newMaxQuota, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: 'Gagal update promo code', details: updateErr.message }, { status: 500 })
      }

      cache = null
      return NextResponse.json({
        success: true,
        message: `Kuota promo "${promo.code}" diubah ke ${newMaxQuota}`
      })
    }

    if (action === 'resetQuota') {
      // Reset used_quota to 0, reactivate
      const { error: updateErr } = await admin
        .from('promo_codes')
        .update({ used_quota: 0, is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: 'Gagal update promo code', details: updateErr.message }, { status: 500 })
      }

      cache = null
      return NextResponse.json({
        success: true,
        message: `Kuota promo "${promo.code}" berhasil direset. Status: Aktif.`
      })
    }

    if (action === 'edit') {
      // Edit multiple fields
      const updates: Record<string, any> = { updated_at: new Date().toISOString() }

      if (body.description !== undefined) {
        updates.description = body.description || null
      }
      if (body.durationMonths !== undefined && body.durationMonths >= 1) {
        updates.duration_months = body.durationMonths
      }
      if (body.endDate !== undefined) {
        updates.end_date = body.endDate ? new Date(body.endDate).toISOString() : null
      }

      if (Object.keys(updates).length <= 1) { // only updated_at
        return NextResponse.json({ error: 'Tidak ada field yang diubah' }, { status: 400 })
      }

      const { error: updateErr } = await admin
        .from('promo_codes')
        .update(updates)
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: 'Gagal update promo code', details: updateErr.message }, { status: 500 })
      }

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
    if (authError) return authError

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id diperlukan (query param)' }, { status: 400 })
    }

    // Get promo info before deleting
    const { data: existingRows, error: fetchErr } = await admin
      .from('promo_codes')
      .select('id, code, used_quota')
      .eq('id', id)
      .limit(1)

    if (fetchErr || !existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: 'Promo code tidak ditemukan' }, { status: 404 })
    }

    const promo = existingRows[0]

    // Delete promo code (user_subscriptions records are kept for history)
    const { error: deleteErr } = await admin
      .from('promo_codes')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      return NextResponse.json({ error: 'Gagal menghapus promo code', details: deleteErr.message }, { status: 500 })
    }

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
