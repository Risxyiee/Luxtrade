import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Helper: Get authenticated user
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        return { id: user.id, email: user.email || '' }
      }
    }
    return null
  } catch {
    return null
  }
}

// GET - Fetch comprehensive analytics
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.id
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'all' // all, week, month, year

    // Build date filter
    let dateFilter: any = {}
    const now = new Date()

    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      dateFilter = { gte: weekAgo.toISOString() }
    } else if (period === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      dateFilter = { gte: monthAgo.toISOString() }
    } else if (period === 'year') {
      const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      dateFilter = { gte: yearAgo.toISOString() }
    }

    // Fetch trades
    let tradesQuery = supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('close_time', { ascending: false })

    if (period !== 'all') {
      tradesQuery = tradesQuery.gte('close_time', dateFilter.gte)
    }

    const { data: trades, error } = await tradesQuery

    if (error) {
      console.error('Analytics fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const tradesList = trades || []

    // Calculate basic analytics
    const totalTrades = tradesList.length
    const winningTrades = tradesList.filter(t => t.profit_loss > 0).length
    const losingTrades = tradesList.filter(t => t.profit_loss < 0).length
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
    const totalPL = tradesList.reduce((sum, t) => sum + (t.profit_loss || 0), 0)

    const profits = tradesList.filter(t => t.profit_loss > 0)
    const losses = tradesList.filter(t => t.profit_loss < 0)
    const avgProfit = profits.length > 0 ? profits.reduce((sum, t) => sum + t.profit_loss, 0) / profits.length : 0
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.profit_loss, 0) / losses.length : 0

    const grossProfit = profits.reduce((sum, t) => sum + t.profit_loss, 0)
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit_loss, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

    // Calculate Max Drawdown
    const sortedByTime = [...tradesList].sort((a, b) =>
      new Date(a.close_time).getTime() - new Date(b.close_time).getTime()
    )

    let maxDrawdown = 0
    let peak = 0
    let cumulative = 0

    sortedByTime.forEach(trade => {
      cumulative += trade.profit_loss
      if (cumulative > peak) {
        peak = cumulative
      }
      const drawdown = peak - cumulative
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    })

    // Sharpe Ratio (simplified)
    const returns = sortedByTime.map(t => t.profit_loss)
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
    const variance = returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0
    const sharpeRatio = variance > 0 ? (avgReturn / Math.sqrt(variance)) * Math.sqrt(252) : 0

    // Equity Curve
    const equityCurve = []
    cumulative = 10000 // Starting equity

    sortedByTime.reverse().forEach(trade => {
      cumulative += trade.profit_loss
      equityCurve.push({
        date: new Date(trade.close_time).toLocaleDateString(),
        equity: cumulative
      })
    })

    // Session Performance
    const sessionMap = new Map<string, { trades: number; pl: number; wins: number }>()
    tradesList.forEach(trade => {
      const session = trade.session || 'Unknown'
      const current = sessionMap.get(session) || { trades: 0, pl: 0, wins: 0 }
      current.trades++
      current.pl += trade.profit_loss
      if (trade.profit_loss > 0) current.wins++
      sessionMap.set(session, current)
    })

    const sessionPerformance = Array.from(sessionMap.entries()).map(([session, data]) => ({
      session,
      trades: data.trades,
      pl: data.pl,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
    }))

    // Monthly Performance
    const monthlyMap = new Map<string, { pl: number; trades: number }>()
    tradesList.forEach(trade => {
      const date = new Date(trade.close_time)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const current = monthlyMap.get(monthKey) || { pl: 0, trades: 0 }
      current.pl += trade.profit_loss
      current.trades++
      monthlyMap.set(monthKey, current)
    })

    const monthlyPerformance = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        pl: data.pl,
        trades: data.trades
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Symbol Performance (NEW)
    const symbolMap = new Map<string, { trades: number; pl: number; wins: number }>()
    tradesList.forEach(trade => {
      const symbol = trade.symbol
      const current = symbolMap.get(symbol) || { trades: 0, pl: 0, wins: 0 }
      current.trades++
      current.pl += trade.profit_loss
      if (trade.profit_loss > 0) current.wins++
      symbolMap.set(symbol, current)
    })

    const symbolPerformance = Array.from(symbolMap.entries())
      .map(([symbol, data]) => ({
        symbol,
        trades: data.trades,
        pl: data.pl,
        wins: data.wins,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
      }))
      .sort((a, b) => b.pl - a.pl) // Sort by profitability

    // Day of Week Performance (NEW)
    const dayOfWeekMap = new Map<number, { trades: number; pl: number; wins: number }>()
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    tradesList.forEach(trade => {
      const day = new Date(trade.close_time).getDay()
      const current = dayOfWeekMap.get(day) || { trades: 0, pl: 0, wins: 0 }
      current.trades++
      current.pl += trade.profit_loss
      if (trade.profit_loss > 0) current.wins++
      dayOfWeekMap.set(day, current)
    })

    const dayOfWeekPerformance = Array.from(dayOfWeekMap.entries())
      .map(([day, data]) => ({
        day: dayNames[day],
        trades: data.trades,
        pl: data.pl,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
      }))
      .sort((a, b) => a.day.localeCompare(b.day))

    // Trade Duration & R:R Ratio Stats (NEW)
    const tradeDurations = tradesList.filter(t => t.trade_duration).map(t => t.trade_duration!)
    const avgTradeDuration = tradeDurations.length > 0
      ? tradeDurations.reduce((a, b) => a + b, 0) / tradeDurations.length
      : 0

    const rrRatios = tradesList.filter(t => t.risk_reward_ratio).map(t => t.risk_reward_ratio!)
    const avgRRRatio = rrRatios.length > 0
      ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length
      : 0

    // Setup Type Performance (NEW)
    const setupTypeMap = new Map<string, { trades: number; pl: number; wins: number }>()
    tradesList.forEach(trade => {
      const setupType = trade.setup_type || 'Unknown'
      const current = setupTypeMap.get(setupType) || { trades: 0, pl: 0, wins: 0 }
      current.trades++
      current.pl += trade.profit_loss
      if (trade.profit_loss > 0) current.wins++
      setupTypeMap.set(setupType, current)
    })

    const setupTypePerformance = Array.from(setupTypeMap.entries())
      .map(([setup_type, data]) => ({
        setup_type,
        trades: data.trades,
        pl: data.pl,
        wins: data.wins,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
      }))
      .sort((a, b) => b.pl - a.pl)

    // Today's Performance (NEW)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTrades = tradesList.filter(t =>
      new Date(t.close_time) >= today
    )
    const todayPL = todayTrades.reduce((sum, t) => sum + t.profit_loss, 0)
    const todayWins = todayTrades.filter(t => t.profit_loss > 0).length
    const todayWinRate = todayTrades.length > 0 ? (todayWins / todayTrades.length) * 100 : 0

    // Active Streak (NEW)
    const sortedByDate = [...tradesList].sort((a, b) =>
      new Date(b.close_time).getTime() - new Date(a.close_time).getTime()
    )

    let currentStreak = 0
    let currentStreakType: 'win' | 'lose' | null = null

    for (const trade of sortedByDate) {
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

    return NextResponse.json({
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
      avgTradeDuration,
      avgRRRatio,
      setupTypePerformance,
      today: {
        trades: todayTrades.length,
        pl: todayPL,
        winRate: todayWinRate
      },
      activeStreak: {
        type: currentStreakType,
        count: currentStreak
      }
    })
  } catch (err) {
    console.error('Analytics API error:', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
