export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db } from '@/lib/db'

const MAX_POINTS = 80
const DEFAULT_BALANCE = 10000

interface EquityPoint {
  date: string
  equity: number
}

function buildPeriodFilter(period: string): { gte?: Date } {
  const now = new Date()
  switch (period) {
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return { gte: d }
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return { gte: d }
    }
    case 'year': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      return { gte: d }
    }
    default:
      return {}
  }
}

/**
 * LTTB-inspired downsampling: keeps first/last, and within each bucket
 * picks the min and max equity points to preserve peaks and valleys.
 */
function downsample(points: EquityPoint[], maxPoints: number): EquityPoint[] {
  if (points.length <= maxPoints) return points

  const result: EquityPoint[] = [points[0]]
  const bucketCount = maxPoints - 2 // reserve first + last
  const bucketSize = (points.length - 2) / bucketCount

  for (let i = 0; i < bucketCount; i++) {
    const start = Math.floor(1 + i * bucketSize)
    const end = Math.min(Math.floor(1 + (i + 1) * bucketSize), points.length - 1)

    if (start >= end) {
      if (start < points.length - 1) result.push(points[start])
      continue
    }

    // Find min and max equity points in this bucket
    let minIdx = start
    let maxIdx = start
    for (let j = start + 1; j < end; j++) {
      if (points[j].equity < points[minIdx].equity) minIdx = j
      if (points[j].equity > points[maxIdx].equity) maxIdx = j
    }

    // Add in chronological order, deduplicate if min === max
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
    // Get initial balance from default trading account
    const account = await db.tradingAccount.findFirst({
      where: { user_id: user.id, is_default: true, is_active: true },
      select: { initial_balance: true },
    })

    const initialBalance = account?.initial_balance ?? DEFAULT_BALANCE

    // Build date filter
    const dateFilter = buildPeriodFilter(period)

    // Fetch trades — only what we need
    const trades = await db.trade.findMany({
      where: { user_id: user.id, close_time: dateFilter },
      select: { profit_loss: true, close_time: true },
      orderBy: { close_time: 'asc' },
    })

    // Build full equity curve
    let running = initialBalance
    let peak = initialBalance
    let trough = initialBalance

    const fullCurve: EquityPoint[] = trades.map((t) => {
      running += t.profit_loss
      if (running > peak) peak = running
      if (running < trough) trough = running
      return {
        date: t.close_time.toISOString().split('T')[0],
        equity: Math.round(running * 100) / 100,
      }
    })

    // Smart downsampling
    const equityCurve = downsample(fullCurve, MAX_POINTS)

    // Recalculate peak/trough from final curve for accuracy after downsampling
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
      tradeCount: trades.length,
    })
  } catch (error) {
    console.error('[equity-curve] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}