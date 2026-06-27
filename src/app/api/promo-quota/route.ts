import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'

/**
 * GET /api/promo-quota?code=TRADERCEPAT
 * Returns remaining quota for a promo code (public, no auth needed).
 * Always reads real data from DB — no fake defaults in production.
 * 
 * SELF-HEALING: If used_quota doesn't match real subscription count,
 * fixes it automatically so the landing page always shows correct data.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Only use defaults when truly offline (local dev without DB)
    if (!isDatabaseAvailable()) {
      return NextResponse.json({
        code: 'TRADERCEPAT',
        maxQuota: 30,
        usedQuota: 0,
        remainingQuota: 30,
        discountPercent: 100,
        durationMonths: 3,
        isActive: true
      })
    }

    await ensureSchema()

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || 'TRADERCEPAT').toUpperCase()

    // Get promo data
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT id, code, description, discount_percent, max_quota, used_quota, duration_months, is_active
       FROM promo_codes WHERE code = $1`,
      code
    )

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    const promo = rows[0]

    // SELF-HEAL: Verify used_quota matches real subscription count
    try {
      const countRows: any[] = await db.$queryRawUnsafe(`
        SELECT COUNT(*)::int as cnt FROM user_subscriptions
        WHERE promo_code_id = $1 AND status = 'active';
      `, promo.id)
      const realCount = countRows?.[0]?.cnt ?? 0
      const storedUsed = Number(promo.used_quota)

      if (storedUsed !== realCount) {
        console.log(`🔧 [promo-quota] FIX: ${code} used_quota was ${storedUsed}, real is ${realCount}. Fixing...`)
        await db.$executeRawUnsafe(`
          UPDATE promo_codes
          SET used_quota = $1, updated_at = NOW()
          WHERE id = $2;
        `, realCount, promo.id)

        // Re-read after fix
        const fixedRows: any[] = await db.$queryRawUnsafe(
          `SELECT used_quota, is_active, max_quota FROM promo_codes WHERE code = $1`,
          code
        )
        if (fixedRows?.length > 0) {
          promo.used_quota = fixedRows[0].used_quota
          promo.is_active = fixedRows[0].is_active
        }
      }

      // Also fix is_active if it's wrong
      const realUsed = Number(promo.used_quota)
      const realMax = Number(promo.max_quota)
      if (promo.is_active && realUsed >= realMax) {
        await db.$executeRawUnsafe(`
          UPDATE promo_codes SET is_active = false, updated_at = NOW() WHERE id = $1;
        `, promo.id)
        promo.is_active = false
      } else if (!promo.is_active && realUsed < realMax) {
        await db.$executeRawUnsafe(`
          UPDATE promo_codes SET is_active = true, end_date = NULL, updated_at = NOW() WHERE id = $1;
        `, promo.id)
        promo.is_active = true
      }
    } catch (_fixErr) {
      // Non-critical — proceed with whatever data we have
    }

    const usedQuota = Number(promo.used_quota)
    const maxQuota = Number(promo.max_quota)

    return NextResponse.json({
      code: promo.code,
      maxQuota,
      usedQuota,
      remainingQuota: Math.max(0, maxQuota - usedQuota),
      discountPercent: Number(promo.discount_percent) || 100,
      durationMonths: Number(promo.duration_months) || 3,
      isActive: promo.is_active
    })
  } catch (error: any) {
    console.error('[promo-quota] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}