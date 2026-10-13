import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * POST /api/promo/downgrade-expired
 * Downgrades users whose promo subscription has expired back to FREE.
 * Called by cron job or admin action.
 */
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ message: 'DB unavailable', downgraded: 0 })
    }

    const now = new Date().toISOString()

    // Find expired active promo subscriptions
    const { data: expired, error: expiredError } = await admin
      .from('user_subscriptions')
      .select('id, user_id, end_date, promo_code_id')
      .eq('status', 'active')
      .not('promo_code_id', 'is', null)
      .not('end_date', 'is', null)
      .lt('end_date', now)

    if (expiredError) {
      console.error('[promo/downgrade] Error fetching expired:', expiredError)
      return NextResponse.json({ error: 'Failed to fetch expired subscriptions' }, { status: 500 })
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({ message: 'No expired subscriptions', downgraded: 0 })
    }

    // Get promo codes for the response
    const promoIds = expired.map(e => e.promo_code_id).filter(Boolean)
    const promoCodeMap = new Map<string, string>()
    if (promoIds.length > 0) {
      const { data: promoCodes } = await admin.from('promo_codes').select('id, code').in('id', promoIds)
      if (promoCodes) {
        for (const pc of promoCodes) {
          promoCodeMap.set(pc.id, pc.code)
        }
      }
    }

    const userIds = expired.map(e => e.user_id)
    const expiredIds = expired.map(e => e.id)

    // Mark subscriptions as expired
    const { error: updateSubError } = await admin
      .from('user_subscriptions')
      .update({ status: 'expired', updated_at: now })
      .in('id', expiredIds)

    if (updateSubError) {
      console.error('[promo/downgrade] Error updating subs:', updateSubError)
    }

    // Downgrade profiles — but only if they don't have another active non-promo subscription
    // Find users who do NOT have another active non-promo subscription
    const { data: activeNonExpired } = await admin
      .from('user_subscriptions')
      .select('user_id')
      .eq('status', 'active')
      .in('user_id', userIds)

    const protectedUserIds = new Set((activeNonExpired || []).map(s => s.user_id))
    const usersToDowngrade = userIds.filter(uid => !protectedUserIds.has(uid))

    if (usersToDowngrade.length > 0) {
      const { error: profileError } = await admin
        .from('profiles')
        .update({
          plan: 'FREE',
          is_pro: false,
          subscription_until: null,
          pro_expiry: null,
          updated_at: now,
        })
        .in('id', usersToDowngrade)

      if (profileError) {
        console.error('[promo/downgrade] Error updating profiles:', profileError)
      }
    }

    // Also update Supabase Auth metadata
    try {
      const { getAdminAuth } = await import('@/lib/supabase-admin-alt')
      const authAdmin = getAdminAuth()
      if (authAdmin) {
        for (const uid of userIds) {
          try {
            const { data: { user: authUser } } = await authAdmin.getUserById(uid)
            const currentMeta = authUser?.user_metadata || {}
            await authAdmin.updateUserById(uid, {
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

    console.log(`[promo/downgrade] Downgraded ${expired.length} expired promo users`)

    return NextResponse.json({
      message: `Downgraded ${expired.length} users`,
      downgraded: expired.length,
      expiredSubscriptions: expired.map(e => ({ userId: e.user_id, promoCode: promoCodeMap.get(e.promo_code_id) || null, expiredAt: e.end_date }))
    })
  } catch (error: any) {
    console.error('[promo/downgrade] Error:', error)
    return NextResponse.json({ error: 'Failed to downgrade expired promos' }, { status: 500 })
  }
}