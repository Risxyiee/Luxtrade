import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    
    // Fetch trades
    let query = supabase
      .from('trades')
      .select('*')
      .order('close_time', { ascending: true })
    
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data: trades, error } = await query
    
    if (error) {
      // Table doesn't exist yet
      if (error.message.includes('does not exist') || error.message.includes('column')) {
        return NextResponse.json({ analytics: getEmptyAnalytics() })
      }
      console.error('Analytics fetch error:', error)
      return NextResponse.json({ analytics: getEmptyAnalytics() })
    }

    if (!trades || trades.length === 0) {
      return NextResponse.json({ analytics: getEmptyAnalytics() })
    }

    // Calculate analytics
    const winningTrades = trades.filter((t: { profit_loss: number }) => t.profit_loss > 0)
    const losingTrades = trades.filter((t: { profit_loss: number }) => t.profit_loss < 0)
    
    const totalPL = trades.reduce((sum: number, t: { profit_loss: number }) => sum + t.profit_loss, 0)
    const totalWins = winningTrades.reduce((sum: number, t: { profit_loss: number }) => sum + t.profit_loss, 0)
    const totalLosses = Math.abs(losingTrades.reduce((sum: number, t: { profit_loss: number }) => sum + t.profit_loss, 0))
    
    const avgProfit = winningTrades.length > 0 ? totalWins / winningTrades.length : 0
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0
    
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0

    // Best and worst trades
    const sortedByPL = [...trades].sort((a: { profit_loss: number }, b: { profit_loss: number }) => b.profit_loss - a.profit_loss)
    const bestTrade = sortedByPL[0] || null
    const worstTrade = sortedByPL[sortedByPL.length - 1] || null

    // Calculate equity curve (starting from $10,000)
    const equityCurve = calculateEquityCurve(trades, 10000)
    
    // Session performance
    const sessionPerformance = getSessionPerformance(trades)

    // Monthly performance
    const monthlyData = getMonthlyPerformance(trades)

    // Symbol performance
    const symbolPerformance = getSymbolPerformance(trades)
    
    // Calculate max drawdown
    const maxDrawdown = calculateMaxDrawdown(equityCurve)
    
    // Calculate Sharpe Ratio (simplified, using daily returns approximation)
    const sharpeRatio = calculateSharpeRatio(trades)

    return NextResponse.json({
      analytics: {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
        totalPL,
        avgProfit,
        avgLoss,
        profitFactor,
        maxDrawdown,
        sharpeRatio,
        bestTrade,
        worstTrade,
        equityCurve,
        sessionPerformance,
        monthlyData,
        symbolPerformance,
      }
    })
  } catch (err) {
    console.error('Analytics error:', err)
    return NextResponse.json({ analytics: getEmptyAnalytics() })
  }
}

function getEmptyAnalytics() {
  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalPL: 0,
    avgProfit: 0,
    avgLoss: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    bestTrade: null,
    worstTrade: null,
    equityCurve: [],
    sessionPerformance: [],
    monthlyData: [],
    symbolPerformance: [],
  }
}

function calculateMaxDrawdown(equityCurve: { date: string; equity: number }[]) {
  if (equityCurve.length < 2) return 0
  
  let maxEquity = equityCurve[0].equity
  let maxDrawdown = 0
  
  for (const point of equityCurve) {
    if (point.equity > maxEquity) {
      maxEquity = point.equity
    }
    const drawdown = maxEquity - point.equity
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }
  
  return maxDrawdown
}

function calculateSharpeRatio(trades: Array<{ profit_loss: number; close_time: string }>) {
  if (trades.length < 2) return 0
  
  // Calculate returns as percentage of average trade size
  const returns = trades.map(t => t.profit_loss)
  
  // Calculate average return
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
  
  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  
  // Sharpe Ratio (annualized approximation, assuming risk-free rate ~ 0)
  // We multiply by sqrt(252) for daily returns annualization approximation
  if (stdDev === 0) return 0
  
  const sharpe = (avgReturn / stdDev) * Math.sqrt(trades.length)
  return Math.min(sharpe, 10) // Cap at 10 for display purposes
}

function calculateEquityCurve(trades: Array<{ close_time: string; profit_loss: number }>, startingBalance: number) {
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.close_time).getTime() - new Date(b.close_time).getTime()
  )

  let equity = startingBalance
  const curve: { date: string; equity: number }[] = [
    { date: 'Start', equity: startingBalance }
  ]

  sortedTrades.forEach(trade => {
    equity += trade.profit_loss
    const date = new Date(trade.close_time)
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
    curve.push({
      date: dateStr,
      equity,
    })
  })

  // If too many points, sample them
  if (curve.length > 50) {
    const sampled: { date: string; equity: number }[] = [curve[0]]
    const step = Math.floor(curve.length / 49)
    for (let i = step; i < curve.length - 1; i += step) {
      sampled.push(curve[i])
    }
    sampled.push(curve[curve.length - 1])
    return sampled
  }

  return curve
}

function getSessionPerformance(trades: Array<{ session: string | null; profit_loss: number }>) {
  const sessions: Record<string, { trades: number; pl: number; wins: number }> = {
    'London': { trades: 0, pl: 0, wins: 0 },
    'New York': { trades: 0, pl: 0, wins: 0 },
    'Asia': { trades: 0, pl: 0, wins: 0 },
    'Off-Market': { trades: 0, pl: 0, wins: 0 },
  }

  trades.forEach(trade => {
    if (trade.session && sessions[trade.session]) {
      sessions[trade.session].trades += 1
      sessions[trade.session].pl += trade.profit_loss
      if (trade.profit_loss > 0) {
        sessions[trade.session].wins += 1
      }
    }
  })

  return Object.entries(sessions).map(([session, data]) => ({
    session,
    trades: data.trades,
    pl: data.pl,
    winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
  }))
}

function getMonthlyPerformance(trades: Array<{ close_time: string; profit_loss: number }>) {
  const monthlyMap = new Map<string, { profit: number; trades: number; wins: number }>()
  
  trades.forEach(trade => {
    const date = new Date(trade.close_time)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    const current = monthlyMap.get(monthKey) || { profit: 0, trades: 0, wins: 0 }
    current.profit += trade.profit_loss
    current.trades += 1
    if (trade.profit_loss > 0) current.wins += 1
    monthlyMap.set(monthKey, current)
  })
  
  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      profit: data.profit,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)
}

function getSymbolPerformance(trades: Array<{ symbol: string; profit_loss: number }>) {
  const symbolMap = new Map<string, { profit: number; trades: number; wins: number }>()
  
  trades.forEach(trade => {
    const current = symbolMap.get(trade.symbol) || { profit: 0, trades: 0, wins: 0 }
    current.profit += trade.profit_loss
    current.trades += 1
    if (trade.profit_loss > 0) current.wins += 1
    symbolMap.set(trade.symbol, current)
  })
  
  return Array.from(symbolMap.entries())
    .map(([symbol, data]) => ({
      symbol,
      profit: data.profit,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10)
}
