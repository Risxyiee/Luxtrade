import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

/**
 * POST /api/promo/downgrade-expired
 * Downgrades users whose promo subscription has expired back to FREE.
 * Called by cron job or admin action.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json({ message: 'DB unavailable', downgraded: 0 })
    }

    // Find expired active promo subscriptions
    const expired: any[] = await db.$queryRawUnsafe(`
      SELECT us.id, us.user_id, us.end_date, p.code as promo_code
      FROM user_subscriptions us
      JOIN promo_codes p ON p.id = us.promo_code_id
      WHERE us.status = 'active'
        AND us.promo_code_id IS NOT NULL
        AND us.end_date IS NOT NULL
        AND us.end_date < NOW()
    `)

    if (!expired || expired.length === 0) {
      return NextResponse.json({ message: 'No expired subscriptions', downgraded: 0 })
    }

    const userIds = expired.map(e => e.user_id)

    // Mark subscriptions as expired
    for (const sub of expired) {
      await db.$executeRawUnsafe(`
        UPDATE user_subscriptions SET status = 'expired', updated_at = NOW() WHERE id = $1;
      `, sub.id)
    }

    // Downgrade profiles — but only if they don't have another active non-promo subscription
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',')
    await db.$executeRawUnsafe(`
      UPDATE profiles SET
        plan = 'FREE',
        is_pro = false,
        subscription_until = NULL,
        pro_expiry = NULL,
        updated_at = NOW()
      WHERE id IN (${placeholders})
        AND id NOT IN (
          SELECT user_id FROM user_subscriptions
          WHERE status = 'active' AND (promo_code_id IS NULL OR end_date >= NOW())
        )
    `, ...userIds)

    // Also update Supabase Auth metadata
    try {
      const { supabaseAdmin: adminClient } = await import('@/lib/supabase-admin-alt')
      if (adminClient) {
        for (const uid of userIds) {
          try {
            const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(uid)
            const currentMeta = authUser?.user_metadata || {}
            await adminClient.auth.admin.updateUserById(uid, {
              user_metadata: {
                ...currentMeta,
                is_pro: false,
                subscription_status: 'expired',
                subscription_until: null,
                updated_at: new Date().toISOString()
              }
            })
          } catch {
            // skip individual failures
          }
        }
      }
    } catch {
      // non-critical
    }

    console.log(`⬇️ [promo/downgrade] Downgraded ${expired.length} expired promo users`)

    return NextResponse.json({
      message: `Downgraded ${expired.length} users`,
      downgraded: expired.length,
      expiredSubscriptions: expired.map(e => ({ userId: e.user_id, promoCode: e.promo_code, expiredAt: e.end_date }))
    })
  } catch (error: any) {
    console.error('[promo/downgrade] Error:', error)
    return NextResponse.json({ error: 'Failed to downgrade expired promos' }, { status: 500 })
  }
}