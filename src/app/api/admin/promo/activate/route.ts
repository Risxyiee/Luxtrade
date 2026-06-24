import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAILS = ['luxtradee@gmail.com']

export async function POST(request: NextRequest) {
  const adminEmail = request.headers.get('x-admin-email')
  if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
    return NextResponse.json({ success: false, message: 'Akses ditolak' }, { status: 403 })
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    return NextResponse.json({ success: false, message: 'Database tidak tersedia' }, { status: 503 })
  }

  const body = await request.json()
  const code = (body.code || 'TRADERCEPAT').trim().toUpperCase()

  try {
    // Dynamic import to avoid Turbopack resolution issues with pg
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({ connectionString: dbUrl, max: 1 })

    try {
      const result = await pool.query(
        `INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at)
         VALUES (gen_random_uuid()::text, $1, 'Diskon 100% — 3 Bulan PRO Gratis! Khusus 30 trader pertama.', 100, 30, 0, 3, NOW(), true, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE SET
           discount_percent = 100, max_quota = 30, used_quota = 0, duration_months = 3, is_active = true, end_date = NULL, updated_at = NOW()
         RETURNING code, discount_percent, max_quota, used_quota, duration_months, is_active;`,
        [code]
      )

      const p = result.rows?.[0]
      if (!p) {
        return NextResponse.json({ success: false, message: 'Gagal mengaktifkan promo' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Promo ${p.code} aktif! 100% diskon, 3 bulan, kuota 30 orang.`,
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
    } finally {
      await pool.end()
    }
  } catch (_err) {
    return NextResponse.json({ success: false, message: 'Gagal mengaktifkan promo. Coba lagi.' }, { status: 500 })
  }
}