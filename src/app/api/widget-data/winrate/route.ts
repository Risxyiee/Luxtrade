import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Widget Data: Win Rate
 * Provides win rate stats for Windows PWA widget
 * Returns: win rate %, wins, losses, streak
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
        template: 'winrate',
        data: { winRate: '0%', wins: 0, losses: 0, streak: 0 }
      })
    }

    // Get recent trades for win rate calc (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: trades } = await supabase
      .from('trades')
      .select('pnl, direction')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())

    const allTrades = trades || []
    const wins = allTrades.filter((t: any) => (t.pnl || 0) > 0).length
    const losses = allTrades.filter((t: any) => (t.pnl || 0) < 0).length
    const total = wins + losses
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

    // Calculate win streak
    let currentStreak = 0
    let maxStreak = 0
    for (const trade of allTrades) {
      if ((trade.pnl || 0) > 0) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }

    return NextResponse.json({
      template: 'winrate',
      data: {
        winRate: `${winRate}%`,
        wins,
        losses,
        streak: maxStreak,
        period: '30 days',
      }
    })
  } catch (error) {
    console.error('[widget-data/winrate] Error:', error)
    return NextResponse.json({
      template: 'winrate',
      data: { winRate: '0%', wins: 0, losses: 0, streak: 0 }
    })
  }
}
