import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * Reset promo code quota (Admin only)
 * POST /api/promo/reset
 * Body: { code: string, maxQuota?: number, isActive?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    // Real admin authentication — verifies Supabase session + role
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

    const body = await request.json()
    const { code, maxQuota, isActive } = body

    if (!code) {
      return NextResponse.json({ error: 'Kode promo wajib diisi' }, { status: 400 })
    }

    if (!isDatabaseAvailable()) {
      return NextResponse.json({ error: 'Database tidak tersedia' }, { status: 503 })
    }

    await ensureSchema()

    const normalizedCode = code.trim().toUpperCase()

    const result: any[] = await (db as any).$queryRawUnsafe(`
      INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at)
      VALUES (gen_random_uuid()::text, $1, $2, 30, $3, 0, 1, NOW(), $4, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        max_quota = $3,
        used_quota = 0,
        is_active = $4,
        updated_at = NOW()
      RETURNING code, discount_percent, max_quota, used_quota, duration_months, is_active;
    `, normalizedCode, `Promo ${normalizedCode}`, maxQuota ? parseInt(maxQuota) : 30, isActive !== undefined ? isActive : true)

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Gagal reset promo' }, { status: 500 })
    }

    const promo = result[0]

    return NextResponse.json({
      success: true,
      message: `Promo ${normalizedCode} berhasil direset`,
      promo: {
        code: promo.code,
        maxQuota: Number(promo.max_quota),
        usedQuota: Number(promo.used_quota),
        remainingQuota: Number(promo.max_quota) - Number(promo.used_quota),
        discountPercent: Number(promo.discount_percent),
        durationMonths: Number(promo.duration_months),
        isActive: promo.is_active,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal reset promo'
    console.error('[promo/reset] Error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}