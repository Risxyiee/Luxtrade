import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Widget Data: Summary
 * Provides summary stats for Windows PWA widget (home screen)
 * Returns: total trades, win rate, total PnL, active account count
 */
export async function GET(req: NextRequest) {
  try {
    const { supabase } = await createClientForApi(req)
    if (!supabase) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 503 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({
        template: 'summary',
        data: {
          totalTrades: 0,
          winRate: '0%',
          totalPnl: '$0',
          status: 'Login to see your stats',
        }
      })
    }

    // Get trade count and basic stats
    const { count: totalTrades } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // FIX (F1): kolom `direction` TIDAK ADA di tabel trades (yang ada `type`)
    // → query lama selalu error/empty. Win rate sebenarnya = profit_loss > 0.
    const { count: winCount } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('profit_loss', 0)

    // Get profile for plan info
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro, subscription_status')
      .eq('id', user.id)
      .single()

    const planLabel = profile?.is_pro ? 'PRO' : 'Free'

    return NextResponse.json({
      template: 'summary',
      data: {
        totalTrades: totalTrades || 0,
        winRate: totalTrades ? `${Math.round(((winCount || 0) / totalTrades) * 100)}%` : '0%',
        totalPnl: '—',
        plan: planLabel,
        status: 'Active',
      }
    })
  } catch (error) {
    console.error('[widget-data/summary] Error:', error)
    return NextResponse.json({
      template: 'summary',
      data: { totalTrades: 0, winRate: '0%', totalPnl: '$0', status: 'Error' }
    })
  }
}
