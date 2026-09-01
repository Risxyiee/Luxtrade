import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { createClientForApi } from '@/lib/supabase/server'

const MAX_POINTS = 80
const DEFAULT_BALANCE = 10000

interface EquityPoint {
  date: string
  equity: number
}

function buildPeriodFilter(period: string): string | null {
  const now = new Date()
  switch (period) {
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString()
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return d.toISOString()
    }
    case 'year': {
      const d = new Date(now)
      d.setFullYear(now.getFullYear() - 1)
      return d.toISOString()
    }
    default:
      return null
  }
}

function downsample(points: EquityPoint[], maxPoints: number): EquityPoint[] {
  if (points.length <= maxPoints) return points

  const result: EquityPoint[] = [points[0]]
  const bucketCount = maxPoints - 2
  const bucketSize = (points.length - 2) / bucketCount

  for (let i = 0; i < bucketCount; i++) {
    const start = Math.floor(1 + i * bucketSize)
    const end = Math.min(Math.floor(1 + (i + 1) * bucketSize), points.length - 1)

    if (start >= end) {
      if (start < points.length - 1) result.push(points[start])
      continue
    }

    let minIdx = start
    let maxIdx = start
    for (let j = start + 1; j < end; j++) {
      if (points[j].equity < points[minIdx].equity) minIdx = j
      if (points[j].equity > points[maxIdx].equity) maxIdx = j
    }

    const indices = [minIdx, maxIdx].sort((a, b) => a - b)
    const unique = indices.filter((v, i, arr) => arr.indexOf(v) === i)
    for (const idx of unique) {
      result.push(points[idx])
    }
  }

  result.push(points[points.length - 1])
  return result
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const period = searchParams.get('period') || 'all'

  try {
    const { supabase } = createClientForApi(request)

    const { data: accounts } = await supabase
      .from('trading_accounts')
      .select('initial_balance')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)

    const initialBalance = accounts && accounts.length > 0
      ? (accounts[0].initial_balance || DEFAULT_BALANCE)
      : DEFAULT_BALANCE

    const dateFilter = buildPeriodFilter(period)

    let query = supabase
      .from('trades')
      .select('profit_loss, close_time')
      .eq('user_id', user.id)
      .order('close_time', { ascending: true })

    if (dateFilter) {
      query = query.gte('close_time', dateFilter)
    }

    const { data: trades, error: tradesError } = await query

    if (tradesError) {
      console.error('[equity-curve] Supabase query error:', tradesError.message)
      return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 })
    }

    const tradeList = trades || []

    let running = initialBalance
    let peak = initialBalance
    let trough = initialBalance

    const fullCurve: EquityPoint[] = tradeList.map((t: any) => {
      running += (t.profit_loss || 0)
      if (running > peak) peak = running
      if (running < trough) trough = running
      const closeDate = t.close_time ? new Date(t.close_time) : new Date()
      return {
        date: closeDate.toISOString().split('T')[0],
        equity: Math.round(running * 100) / 100,
      }
    })

    const equityCurve = downsample(fullCurve, MAX_POINTS)

    let finalPeak = initialBalance
    let finalTrough = initialBalance
    for (const p of equityCurve) {
      if (p.equity > finalPeak) finalPeak = p.equity
      if (p.equity < finalTrough) finalTrough = p.equity
    }

    const currentBalance = fullCurve.length > 0
      ? fullCurve[fullCurve.length - 1].equity
      : initialBalance

    const totalPL = currentBalance - initialBalance
    const maxDrawdown = finalPeak > 0
      ? Math.round(((finalPeak - finalTrough) / finalPeak) * 10000) / 100
      : 0

    const totalReturnPct = initialBalance > 0
      ? Math.round((totalPL / initialBalance) * 10000) / 100
      : 0

    return NextResponse.json({
      equityCurve,
      initialBalance: Math.round(initialBalance * 100) / 100,
      currentBalance: Math.round(currentBalance * 100) / 100,
      totalPL: Math.round(totalPL * 100) / 100,
      peakEquity: Math.round(finalPeak * 100) / 100,
      troughEquity: Math.round(finalTrough * 100) / 100,
      maxDrawdown,
      totalReturnPct,
      tradeCount: tradeList.length,
    })
  } catch (error) {
    console.error('[equity-curve] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
