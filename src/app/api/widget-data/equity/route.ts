import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Widget Data: Equity Curve
 * Provides equity curve data points for Windows PWA widget
 * Returns: recent equity data points for mini chart
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
        template: 'equity',
        data: { points: [], label: 'Login required' }
      })
    }

    // Get recent equity curve entries (last 14 days)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const { data: equityData } = await supabase
      .from('equity_curve')
      .select('date, equity')
      .eq('user_id', user.id)
      .gte('date', fourteenDaysAgo.toISOString())
      .order('date', { ascending: true })
      .limit(14)

    const points = (equityData || []).map((entry: any) => ({
      date: entry.date,
      value: entry.equity
    }))

    return NextResponse.json({
      template: 'equity',
      data: {
        points,
        label: points.length > 0 ? `${points.length} days` : 'No data yet',
      }
    })
  } catch (error) {
    console.error('[widget-data/equity] Error:', error)
    return NextResponse.json({
      template: 'equity',
      data: { points: [], label: 'Error' }
    })
  }
}
