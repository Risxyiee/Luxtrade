import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
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
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ rewarded: false, reason: 'DB unavailable' })
    }

    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.id

    // Check if already rewarded
    const { data: profileRows } = await admin.from('profiles')
      .select('plan, is_pro, subscription_until, pro_expiry, first_trade_reward_claimed')
      .eq('id', userId)
      .maybeSingle()

    const p = profileRows
    if (!p) {
      return NextResponse.json({ rewarded: false, reason: 'Profile not found' })
    }

    // Already PRO (from promo or payment) — skip
    if (p.is_pro) {
      return NextResponse.json({ rewarded: false, reason: 'Already PRO' })
    }

    // Check trade count
    const { count: tradeCount } = await admin.from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (!tradeCount || tradeCount === 0) {
      return NextResponse.json({ rewarded: false, reason: 'No trades yet' })
    }

    // Check if already claimed this reward
    if (p.first_trade_reward_claimed) {
      return NextResponse.json({ rewarded: false, reason: 'Already claimed' })
    }

    // Award 1-day PRO
    const now = new Date()
    const rewardEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999)

    const { error: updateError } = await admin.from('profiles').update({
      plan: 'PRO',
      is_pro: true,
      subscription_until: rewardEnd.toISOString(),
      pro_expiry: rewardEnd.toISOString(),
      has_ever_been_pro: true,
      first_trade_reward_claimed: true,
      updated_at: now.toISOString(),
    }).eq('id', userId).eq('plan', 'FREE')

    if (updateError) {
      console.warn('[reward/first-trade] Profile update failed:', updateError.message)
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

    console.log(`[reward/first-trade] user=${userId} awarded 1-day PRO (until ${rewardEnd.toISOString()})`)

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
