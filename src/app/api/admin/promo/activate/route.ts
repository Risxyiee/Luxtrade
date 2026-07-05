import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ success: false, message: 'Database tidak tersedia. Pastikan DATABASE_URL sudah di-set ke PostgreSQL.' }, { status: 503 })
  }

  const body = await request.json()
  const code = (body.code || 'TRADERCEPAT').trim().toUpperCase()
  const maxQuota = body.maxQuota ? parseInt(body.maxQuota) : 30
  const durationMonths = body.durationMonths ? parseInt(body.durationMonths) : 3

  try {
    await ensureSchema()

    // Use raw SQL with the proper db connection (handles Supabase pooler automatically)
    const result: any[] = await (db as any).$queryRawUnsafe(`
      INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at)
      VALUES (gen_random_uuid()::text, $1, $2, 100, $3, 0, $4, NOW(), true, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        discount_percent = 100,
        max_quota = $3,
        used_quota = 0,
        duration_months = $4,
        is_active = true,
        end_date = NULL,
        updated_at = NOW()
      RETURNING code, discount_percent, max_quota, used_quota, duration_months, is_active;
    `, code, `Diskon 100% — ${durationMonths} Bulan PRO Gratis! Khusus ${maxQuota} trader pertama.`, maxQuota, durationMonths)

    const p = result?.[0]
    if (!p) {
      return NextResponse.json({ success: false, message: 'Gagal mengaktifkan promo' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Promo ${p.code} aktif! 100% diskon, ${durationMonths} bulan, kuota ${maxQuota} orang. (used_quota reset ke 0)`,
      promo: {
        code: p.code,
        discountPercent: Number(p.discount_percent),
        maxQuota: Number(p.max_quota),
        usedQuota: Number(p.used_quota),
        remaining: Number(p.max_quota) - Number(p.used_quota),
        durationMonths: Number(p.duration_months),
        isActive: p.is_active,
      },
    })
  } catch (err: any) {
    console.error('[promo/activate] Error:', err)
    return NextResponse.json({ success: false, message: `Gagal: ${err.message || 'Coba lagi.'}` }, { status: 500 })
  }
}