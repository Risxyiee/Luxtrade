/**
 * Calculate profit/loss for a trade
 */
export interface ProfitLossInput {
  type: 'BUY' | 'SELL'
  entryPrice: number
  exitPrice: number
  lotSize: number
  pipValue: number
}

export interface ProfitLossResult {
  profit: number
  profitPercentage: number
}

export function calculateProfitLoss(input: ProfitLossInput): ProfitLossResult {
  const { type, entryPrice, exitPrice, lotSize, pipValue } = input

  let pips: number

  if (type === 'BUY') {
    // Long position: Exit - Entry
    pips = (exitPrice - entryPrice) * 10000 // Assuming 4 decimal places
  } else {
    // Short position: Entry - Exit
    pips = (entryPrice - exitPrice) * 10000
  }

  const profit = pips * lotSize * pipValue
  const profitPercentage = (profit / (entryPrice * lotSize * 100000)) * 100

  return {
    profit: Math.round(profit * 100) / 100,
    profitPercentage: Math.round(profitPercentage * 100) / 100
  }
}

/**
 * Calculate win rate from trades
 */
export interface Trade {
  profit: number
}

export function calculateWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0

  const wins = trades.filter(trade => trade.profit > 0).length
  return Math.round((wins / trades.length) * 100)
}

/**
 * Calculate profit factor from trades
 */
export function calculateProfitFactor(trades: Trade[]): number {
  if (trades.length === 0) return 0

  const grossProfit = trades
    .filter(trade => trade.profit > 0)
    .reduce((sum, trade) => sum + trade.profit, 0)

  const grossLoss = trades
    .filter(trade => trade.profit < 0)
    .reduce((sum, trade) => sum + Math.abs(trade.profit), 0)

  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0

  return Math.round((grossProfit / grossLoss) * 100) / 100
}

/**
 * Calculate total P&L
 */
export function calculateTotalProfitLoss(trades: Trade[]): number {
  return trades.reduce((sum, trade) => sum + trade.profit, 0)
}

/**
 * Calculate average trade
 */
export function calculateAverageTrade(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const total = calculateTotalProfitLoss(trades)
  return Math.round((total / trades.length) * 100) / 100
}

/**
 * Calculate maximum drawdown
 */
export function calculateMaxDrawdown(trades: Trade[]): number {
  if (trades.length === 0) return 0

  let peak = 0
  let maxDrawdown = 0
  let runningTotal = 0

  trades.forEach(trade => {
    runningTotal += trade.profit

    if (runningTotal > peak) {
      peak = runningTotal
    }

    const drawdown = ((peak - runningTotal) / peak) * 100
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  })

  return Math.round(maxDrawdown * 100) / 100
}
