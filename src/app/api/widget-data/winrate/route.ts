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

    // F2 FIX: kolom "pnl, direction" TIDAK ADA di tabel trades (nama asli:
    // profit_loss) — query ini selalu error → widget selalu 0%. Sekalian:
    // hitung lewat head-count SQL, bukan scan row 30 hari ke JS.
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: winCount, error: winErr } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('profit_loss', 0)
      .gte('close_time', thirtyDaysAgo.toISOString())

    const { count: lossCount, error: lossErr } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lt('profit_loss', 0)
      .gte('close_time', thirtyDaysAgo.toISOString())

    if (winErr || lossErr) {
      console.error('[widget-data/winrate] count query error:', winErr?.message || lossErr?.message)
    }

    const wins = winCount || 0
    const losses = lossCount || 0
    const total = wins + losses
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

    // Streak: ambil 30 trade terakhir (close_time desc) — cukup utk streak berjalan
    let maxStreak = 0
    try {
      const { data: recent } = await supabase
        .from('trades')
        .select('profit_loss, close_time')
        .eq('user_id', user.id)
        .gte('close_time', thirtyDaysAgo.toISOString())
        .order('close_time', { ascending: false })
        .limit(30)
      let currentStreak = 0
      for (const trade of recent || []) {
        if ((trade.profit_loss || 0) > 0) {
          currentStreak++
          maxStreak = Math.max(maxStreak, currentStreak)
        } else {
          break // streak berjalan terputus pada loss terbaru
        }
      }
    } catch { /* streak opsional */ }

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
