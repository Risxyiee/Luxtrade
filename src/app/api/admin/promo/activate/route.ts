import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = ['luxtradee@gmail.com']

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(request: NextRequest) {
  const adminEmail = request.headers.get('x-admin-email')
  if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
    return NextResponse.json({ success: false, message: 'Akses ditolak' }, { status: 403 })
  }

  const client = getAdminClient()
  if (!client) {
    return NextResponse.json({ success: false, message: 'Supabase admin tidak tersedia' }, { status: 503 })
  }

  const body = await request.json()
  const code = (body.code || 'TRADERCEPAT').trim().toUpperCase()

  try {
    const { data: existing } = await client
      .from('promo_codes')
      .select('id, code')
      .eq('code', code)
      .maybeSingle()

    let promo: any

    if (existing) {
      const { data, error } = await client
        .from('promo_codes')
        .update({
          discount_percent: 100,
          max_quota: 30,
          used_quota: 0,
          duration_months: 3,
          is_active: true,
          end_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq('code', code)
        .select()
        .single()

      if (error) throw error
      promo = data
    } else {
      const { data, error } = await client
        .from('promo_codes')
        .insert({
          code,
          description: 'Diskon 100% — 3 Bulan PRO Gratis! Khusus 30 trader pertama.',
          discount_percent: 100,
          max_quota: 30,
          used_quota: 0,
          duration_months: 3,
          is_active: true,
          end_date: null,
        })
        .select()
        .single()

      if (error) throw error
      promo = data
    }

    return NextResponse.json({
      success: true,
      message: `Promo ${promo.code} aktif! 100% diskon, 3 bulan, kuota 30 orang.`,
      promo: {
        code: promo.code,
        discountPercent: promo.discount_percent ?? 100,
        maxQuota: promo.max_quota ?? 30,
        usedQuota: promo.used_quota ?? 0,
        remaining: (promo.max_quota ?? 30) - (promo.used_quota ?? 0),
        durationMonths: promo.duration_months ?? 3,
        isActive: promo.is_active ?? true,
      },
    })
  } catch (_err) {
    return NextResponse.json({ success: false, message: 'Gagal mengaktifkan promo. Coba lagi.' }, { status: 500 })
  }
}