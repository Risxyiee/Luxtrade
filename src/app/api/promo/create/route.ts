import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { edgeCrypto } from '@/lib/edge-crypto'

/**
 * Create new promo code (Admin only)
 * POST /api/promo/create
 * Body: { code: string, description?: string, discountPercent: number, maxQuota: number, durationMonths: number, startDate?: string, endDate?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await admin.from('profiles').select('role').eq('id', authUser.id).maybeSingle()
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const {
      code,
      description,
      discountPercent,
      maxQuota,
      durationMonths,
      startDate,
      endDate
    } = body

    // Validate required fields
    if (!code || !discountPercent || !maxQuota || !durationMonths) {
      return NextResponse.json(
        { error: 'code, discountPercent, maxQuota, and durationMonths are required' },
        { status: 400 }
      )
    }

    // Normalize code to uppercase
    const normalizedCode = code.trim().toUpperCase()

    // Check if promo code already exists
    const { data: existing } = await admin.from('promo_codes').select('id').eq('code', normalizedCode).maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: false,
        message: 'Kode promo sudah ada'
      })
    }

    // Create promo code
    const { error: insertError } = await admin.from('promo_codes').insert({
      id: edgeCrypto.randomUUID(),
      code: normalizedCode,
      description: description || null,
      discount_percent: parseFloat(discountPercent),
      max_quota: parseInt(maxQuota),
      used_quota: 0,
      duration_months: parseInt(durationMonths),
      start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      is_active: true,
    })

    if (insertError) {
      return NextResponse.json({ error: 'Gagal membuat kode promo' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Kode promo berhasil dibuat'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Gagal membuat kode promo' },
      { status: 500 }
    )
  }
}