import type { Trade } from '@/types'

export function calculateConsecutiveStreaks(trades: Trade[], type: 'win' | 'lose'): number {
  if (trades.length === 0) return 0
  const sorted = [...trades].sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime())
  let maxStreak = 0
  let currentStreak = 0
  for (const trade of sorted) {
    const isMatch = type === 'win' ? trade.profit_loss > 0 : trade.profit_loss < 0
    if (isMatch) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }
  return maxStreak
}

export function calculateActiveStreak(trades: Trade[]): { type: 'win' | 'lose' | null; count: number } {
  if (trades.length === 0) return { type: null, count: 0 }
  
  const sorted = [...trades].sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime())
  let streakCount = 0
  let streakType: 'win' | 'lose' | null = null
  
  for (const trade of sorted) {
    const isWin = trade.profit_loss > 0
    const isLoss = trade.profit_loss < 0
    
    if (streakType === null) {
      if (isWin) {
        streakType = 'win'
        streakCount = 1
      } else if (isLoss) {
        streakType = 'lose'
        streakCount = 1
      }
    } else if (streakType === 'win' && isWin) {
      streakCount++
    } else if (streakType === 'lose' && isLoss) {
      streakCount++
    } else {
      break
    }
  }
  
  return { type: streakType, count: streakCount }
}

export function getTodayPerformance(trades: Trade[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const todayTrades = trades.filter(t => {
    const tradeDate = new Date(t.close_time)
    tradeDate.setHours(0, 0, 0, 0)
    return tradeDate.getTime() === today.getTime()
  })
  
  const totalPL = todayTrades.reduce((sum, t) => sum + t.profit_loss, 0)
  const wins = todayTrades.filter(t => t.profit_loss > 0).length
  const losses = todayTrades.filter(t => t.profit_loss < 0).length
  
  return {
    trades: todayTrades.length,
    totalPL,
    wins,
    losses,
    winRate: todayTrades.length > 0 ? (wins / todayTrades.length) * 100 : 0
  }
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

export function getWeeklyPerformance(trades: Trade[]) {
  const weekStart = getWeekStart()
  weekStart.setHours(0, 0, 0, 0)
  
  const weekTrades = trades.filter(t => {
    const tradeDate = new Date(t.close_time)
    tradeDate.setHours(0, 0, 0, 0)
    return tradeDate.getTime() >= weekStart.getTime()
  })
  
  const totalPL = weekTrades.reduce((sum, t) => sum + t.profit_loss, 0)
  const wins = weekTrades.filter(t => t.profit_loss > 0).length
  const losses = weekTrades.filter(t => t.profit_loss < 0).length
  
  return {
    trades: weekTrades.length,
    totalPL,
    wins,
    losses,
    winRate: weekTrades.length > 0 ? (wins / weekTrades.length) * 100 : 0
  }
}