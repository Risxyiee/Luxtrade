import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { getSupabaseAdminAuthFromClient, supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/reward/first-trade
 * Awards 1-day PRO to FREE users after their first trade.
 * Only triggers ONCE per user (tracked by first_trade_reward_claimed in profiles).
 *
 * Called from the client after a trade is successfully created.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDatabaseAvailable()) {
      return NextResponse.json({ rewarded: false, reason: 'DB unavailable' })
    }

    const userId = authUser.id

    // Check if already rewarded
    const profile: any = await db.$queryRawUnsafe(`
      SELECT plan, is_pro, subscription_until, pro_expiry
      FROM profiles WHERE id = $1
    `, userId)

    const p = Array.isArray(profile) ? profile[0] : null
    if (!p) {
      return NextResponse.json({ rewarded: false, reason: 'Profile not found' })
    }

    // Already PRO (from promo or payment) — skip
    if (p.is_pro) {
      return NextResponse.json({ rewarded: false, reason: 'Already PRO' })
    }

    // Check trade count
    const tradeCount: any[] = await db.$queryRawUnsafe(`
      SELECT count(*)::int AS cnt FROM trades WHERE user_id = $1
    `, userId)

    const count = tradeCount?.[0]?.cnt || 0
    if (count === 0) {
      return NextResponse.json({ rewarded: false, reason: 'No trades yet' })
    }

    // Check if already claimed this reward
    const rewarded: any[] = await db.$queryRawUnsafe(`
      SELECT first_trade_reward_claimed FROM profiles WHERE id = $1
    `, userId)

    if (rewarded?.[0]?.first_trade_reward_claimed) {
      return NextResponse.json({ rewarded: false, reason: 'Already claimed' })
    }

    // Award 1-day PRO
    const now = new Date()
    const rewardEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999)

    await db.$executeRawUnsafe(`
      UPDATE profiles SET
        plan = 'PRO',
        is_pro = true,
        subscription_until = $1,
        pro_expiry = $1,
        has_ever_been_pro = true,
        first_trade_reward_claimed = true,
        updated_at = NOW()
      WHERE id = $2
        AND plan = 'FREE'
    `, rewardEnd, userId)

    // Also mark in Supabase profiles table
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from('profiles').update({
          plan: 'PRO',
          is_pro: true,
          subscription_until: rewardEnd.toISOString(),
          pro_expiry: rewardEnd.toISOString(),
          has_ever_been_pro: true,
        }).eq('id', userId)
      }
    } catch (err: any) {
      console.warn('[reward/first-trade] Supabase sync failed:', err.message?.slice(0, 80))
    }

    // Update auth metadata
    try {
      const authAdmin = getSupabaseAdminAuthFromClient()
      if (authAdmin) {
        const { data: { user } } = await authAdmin.getUserById(userId)
        const meta = user?.user_metadata || {}
        await authAdmin.updateUserById(userId, {
          user_metadata: {
            ...meta,
            is_pro: true,
            subscription_status: 'active',
            subscription_until: rewardEnd.toISOString(),
            first_trade_reward: true,
          }
        })
      }
    } catch (err: any) {
      console.warn('[reward/first-trade] Auth meta update failed:', err.message?.slice(0, 80))
    }

    console.log(`🎁 [reward/first-trade] user=${userId} awarded 1-day PRO (until ${rewardEnd.toISOString()})`)

    return NextResponse.json({
      rewarded: true,
      plan: 'PRO',
      rewardDuration: '1 day',
      expiresAt: rewardEnd.toISOString(),
    })
  } catch (error: any) {
    console.error('[reward/first-trade] Error:', error)
    return NextResponse.json({ rewarded: false, error: error.message }, { status: 500 })
  }
}
