import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { isUserPro } from '@/lib/pro-check'

// In-memory cache keyed by userId+period (30s TTL)
const analyticsCache = new Map<string, { data: any; expiry: number }>()
const CACHE_TTL = 30_000 // 30 seconds

function getCacheKey(userId: string, period: string, accountId: string | null) {
  return `${userId}:${period}:${accountId || 'all'}`
}

// GET - Fetch comprehensive analytics using optimized queries
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pro = await isUserPro(authUser.id)
    if (!pro) {
      return NextResponse.json({
        error: 'Fitur ini hanya untuk pengguna PRO. Upgrade ke PRO untuk akses!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
    }

    const userId = authUser.id
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'all'
    const accountId = searchParams.get('account_id') || null

    // Check cache first
    const cacheKey = getCacheKey(userId, period, accountId)
    const cached = analyticsCache.get(cacheKey)
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
      })
    }

    // Build date filter
    let dateFilter: any = {}
    const now = new Date()

    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      dateFilter = { gte: weekAgo }
    } else if (period === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      dateFilter = { gte: monthAgo }
    } else if (period === 'year') {
      const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      dateFilter = { gte: yearAgo }
    }

    // Build where clause
    const whereClause: any = { user_id: userId }
    if (period !== 'all') {
      whereClause.close_time = dateFilter
    }
    if (accountId) {
      whereClause.account_id = accountId
    }

    // ─── OPTIMIZATION: Use Prisma aggregate for basic stats (1 query instead of N) ───
    const baseAgg = await db.trade.aggregate({
      where: whereClause,
      _count: { id: true },
      _sum: { profit_loss: true },
      _avg: { profit_loss: true },
    })

    const totalTrades = baseAgg._count.id
    const totalPL = baseAgg._sum.profit_loss || 0

    // Win/loss aggregate (2 queries instead of scanning all trades)
    const [winAgg, lossAgg] = await Promise.all([
      db.trade.aggregate({
        where: { ...whereClause, profit_loss: { gt: 0 } },
        _count: { id: true },
        _sum: { profit_loss: true },
        _avg: { profit_loss: true },
      }),
      db.trade.aggregate({
        where: { ...whereClause, profit_loss: { lt: 0 } },
        _count: { id: true },
        _sum: { profit_loss: true },
        _avg: { profit_loss: true },
      }),
    ])

    const winningTrades = winAgg._count.id
    const losingTrades = lossAgg._count.id
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
    const avgProfit = winAgg._avg.profit_loss || 0
    const avgLoss = lossAgg._avg.profit_loss || 0

    const grossProfit = winAgg._sum.profit_loss || 0
    const grossLoss = Math.abs(lossAgg._sum.profit_loss || 0)
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

    // ─── Only fetch columns needed for time-series computations ───
    const trades = await db.trade.findMany({
      where: whereClause,
      select: {
        profit_loss: true,
        close_time: true,
        session: true,
        symbol: true,
        setup_type: true,
        trade_duration: true,
        risk_reward_ratio: true,
      },
      orderBy: { close_time: 'asc' }, // chronological for equity curve
    })

    // ─── Max Drawdown + Equity Curve (single pass) ───
    // Fetch user's default trading account for initial balance
    let startBalance = 10000
    try {
      const defaultAccount = await db.tradingAccount.findFirst({
        where: { user_id: userId, is_active: true },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        select: { initial_balance: true },
      })
      if (defaultAccount && defaultAccount.initial_balance > 0) {
        startBalance = defaultAccount.initial_balance
      }
    } catch (e) {
      console.warn('[analytics] Could not fetch trading account for initial balance:', e)
    }

    let maxDrawdown = 0
    let peak = 0
    let cumulative = startBalance
    const equityCurve: { date: string; equity: number }[] = []

    for (const trade of trades) {
      cumulative += trade.profit_loss
      if (cumulative > peak) peak = cumulative
      const drawdown = peak - cumulative
      if (drawdown > maxDrawdown) maxDrawdown = drawdown

      equityCurve.push({
        date: trade.close_time.toISOString().split('T')[0],
        equity: Math.round(cumulative * 100) / 100,
      })
    }

    // ─── Sharpe Ratio ───
    const returns = trades.map(t => t.profit_loss)
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
    const variance = returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0
    const sharpeRatio = variance > 0 ? (avgReturn / Math.sqrt(variance)) * Math.sqrt(252) : 0

    // ─── Session Performance (single pass) ───
    const sessionMap = new Map<string, { trades: number; pl: number; wins: number }>()
    // ─── Monthly Performance (single pass) ───
    const monthlyMap = new Map<string, { pl: number; trades: number }>()
    // ─── Symbol Performance (single pass) ───
    const symbolMap = new Map<string, { trades: number; pl: number; wins: number }>()
    // ─── Day of Week Performance (single pass) ───
    const dayOfWeekMap = new Map<number, { trades: number; pl: number; wins: number }>()
    // ─── Setup Type Performance (single pass) ───
    const setupTypeMap = new Map<string, { trades: number; pl: number; wins: number }>()
    // ─── Today's Performance + Trade Duration + R:R (single pass) ───
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    let todayPL = 0, todayWins = 0, todayTradeCount = 0
    let durationSum = 0, durationCount = 0
    let rrSum = 0, rrCount = 0

    for (const trade of trades) {
      const isWin = trade.profit_loss > 0

      // Session
      const session = trade.session || 'Unknown'
      const sess = sessionMap.get(session) || { trades: 0, pl: 0, wins: 0 }
      sess.trades++; sess.pl += trade.profit_loss; if (isWin) sess.wins++
      sessionMap.set(session, sess)

      // Monthly
      const date = new Date(trade.close_time)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const month = monthlyMap.get(monthKey) || { pl: 0, trades: 0 }
      month.pl += trade.profit_loss; month.trades++
      monthlyMap.set(monthKey, month)

      // Symbol
      const sym = symbolMap.get(trade.symbol) || { trades: 0, pl: 0, wins: 0 }
      sym.trades++; sym.pl += trade.profit_loss; if (isWin) sym.wins++
      symbolMap.set(trade.symbol, sym)

      // Day of week
      const day = date.getDay()
      const dow = dayOfWeekMap.get(day) || { trades: 0, pl: 0, wins: 0 }
      dow.trades++; dow.pl += trade.profit_loss; if (isWin) dow.wins++
      dayOfWeekMap.set(day, dow)

      // Setup type
      const st = trade.setup_type || 'Unknown'
      const setup = setupTypeMap.get(st) || { trades: 0, pl: 0, wins: 0 }
      setup.trades++; setup.pl += trade.profit_loss; if (isWin) setup.wins++
      setupTypeMap.set(st, setup)

      // Today's stats
      if (date >= todayStart) {
        todayPL += trade.profit_loss
        if (isWin) todayWins++
        todayTradeCount++
      }

      // Duration & R:R
      if (trade.trade_duration) { durationSum += trade.trade_duration; durationCount++ }
      if (trade.risk_reward_ratio) { rrSum += trade.risk_reward_ratio; rrCount++ }
    }

    const sessionPerformance = Array.from(sessionMap.entries()).map(([session, data]) => ({
      session,
      trades: data.trades,
      pl: data.pl,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }))

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const monthlyPerformance = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, pl: data.pl, trades: data.trades }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const symbolPerformance = Array.from(symbolMap.entries())
      .map(([symbol, data]) => ({
        symbol, trades: data.trades, pl: data.pl, wins: data.wins,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pl - a.pl)

    const dayOfWeekPerformance = Array.from(dayOfWeekMap.entries())
      .map(([day, data]) => ({
        day: dayNames[day], trades: data.trades, pl: data.pl,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      }))
      .sort((a, b) => a.day.localeCompare(b.day))

    const setupTypePerformance = Array.from(setupTypeMap.entries())
      .map(([setup_type, data]) => ({
        setup_type, trades: data.trades, pl: data.pl, wins: data.wins,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pl - a.pl)

    // ─── Active Streak (from most recent trades) ───
    let currentStreak = 0
    let currentStreakType: 'win' | 'lose' | null = null

    for (let i = trades.length - 1; i >= 0; i--) {
      const trade = trades[i]
      if (currentStreakType === null) {
        currentStreakType = trade.profit_loss > 0 ? 'win' : 'lose'
        currentStreak = 1
      } else if (
        (currentStreakType === 'win' && trade.profit_loss > 0) ||
        (currentStreakType === 'lose' && trade.profit_loss < 0)
      ) {
        currentStreak++
      } else {
        break
      }
    }

    const responseData = {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPL,
      avgProfit,
      avgLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      equityCurve,
      sessionPerformance,
      monthlyPerformance,
      symbolPerformance,
      dayOfWeekPerformance,
      avgTradeDuration: durationCount > 0 ? durationSum / durationCount : 0,
      avgRRRatio: rrCount > 0 ? rrSum / rrCount : 0,
      setupTypePerformance,
      today: {
        trades: todayTradeCount,
        pl: todayPL,
        winRate: todayTradeCount > 0 ? (todayWins / todayTradeCount) * 100 : 0,
      },
      activeStreak: {
        type: currentStreakType,
        count: currentStreak,
      },
    }

    // Cache the result
    analyticsCache.set(cacheKey, { data: responseData, expiry: Date.now() + CACHE_TTL })

    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('Analytics API error:', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
