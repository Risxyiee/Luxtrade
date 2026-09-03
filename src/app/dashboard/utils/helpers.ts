// Helper: Format date to ISO string for database storage
export function formatLocalDateTime(date: Date): string {
  return date.toISOString()
}

// Helper: Format date to WIB (Indonesia) timezone
export function formatToWIB(date: Date): string {
  // WIB is UTC+7
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
  const wibTime = new Date(utc + (3600000 * 7))
  
  const year = wibTime.getFullYear()
  const month = String(wibTime.getMonth() + 1).padStart(2, '0')
  const day = String(wibTime.getDate()).padStart(2, '0')
  const hours = String(wibTime.getHours()).padStart(2, '0')
  const minutes = String(wibTime.getMinutes()).padStart(2, '0')
  const seconds = String(wibTime.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Helper: Format date for display (respects user's local timezone)
export function formatDateForDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Helper: Convert datetime-local input (which is in user's local timezone) to ISO
export function datetimeLocalToISO(datetimeLocal: string): string {
  if (!datetimeLocal) return ''
  // datetime-local gives us YYYY-MM-DDTHH:mm in user's local timezone
  // We need to convert it to ISO string preserving the local time
  const date = new Date(datetimeLocal)
  return date.toISOString()
}

// Helper: Convert ISO string to datetime-local format (for input value)
export function isoToDatetimeLocal(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  // Get local date components
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Mood options for journal
export const moodOptions = [
  { value: 'confident', label: 'Confident', icon: 'Smile', color: 'text-emerald-400' },
  { value: 'neutral', label: 'Neutral', icon: 'Meh', color: 'text-cyan-400' },
  { value: 'anxious', label: 'Anxious', icon: 'Frown', color: 'text-red-400' },
]

// Market conditions for journal
export const marketConditions = [
  { value: 'trending_up', label: 'Trending Up', icon: 'TrendingUp' },
  { value: 'trending_down', label: 'Trending Down', icon: 'TrendingDown' },
  { value: 'ranging', label: 'Ranging', icon: 'Activity' },
  { value: 'volatile', label: 'Volatile', icon: 'AlertTriangle' },
]

// Helper: Calculate consecutive winning/losing streaks
export function calculateConsecutiveStreaks(trades: { profit_loss: number }[]) {
  let currentWinStreak = 0
  let currentLoseStreak = 0
  let maxWinStreak = 0
  let maxLoseStreak = 0

  for (let i = trades.length - 1; i >= 0; i--) {
    const trade = trades[i]
    if (trade.profit_loss > 0) {
      currentWinStreak++
      currentLoseStreak = 0
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
    } else if (trade.profit_loss < 0) {
      currentLoseStreak++
      currentWinStreak = 0
      maxLoseStreak = Math.max(maxLoseStreak, currentLoseStreak)
    } else {
      // Break even doesn't affect streak
      currentWinStreak = 0
      currentLoseStreak = 0
    }
  }

  return { currentWinStreak, currentLoseStreak, maxWinStreak, maxLoseStreak }
}

// Helper: Calculate active streak (current ongoing streak)
export function calculateActiveStreak(trades: { profit_loss: number }[]) {
  if (!trades.length) return { type: 'none' as const, count: 0 }
  const last = trades[trades.length - 1]
  if (last.profit_loss > 0) {
    let count = 0
    for (let i = trades.length - 1; i >= 0; i--) {
      if (trades[i].profit_loss > 0) count++
      else break
    }
    return { type: 'win' as const, count }
  }
  if (last.profit_loss < 0) {
    let count = 0
    for (let i = trades.length - 1; i >= 0; i--) {
      if (trades[i].profit_loss < 0) count++
      else break
    }
    return { type: 'loss' as const, count }
  }
  return { type: 'none' as const, count: 0 }
}

// Helper: Get today's performance metrics
export function getTodayPerformance(trades: { profit_loss: number; close_time: string }[]) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const todayTrades = trades.filter(t => {
    const d = new Date(t.close_time).toISOString().slice(0, 10)
    return d === todayStr
  })
  const totalPL = todayTrades.reduce((sum, t) => sum + t.profit_loss, 0)
  const wins = todayTrades.filter(t => t.profit_loss > 0).length
  return { trades: todayTrades.length, totalPL, wins, winRate: todayTrades.length > 0 ? (wins / todayTrades.length) * 100 : 0 }
}

// Helper: Get this week's performance metrics
export function getWeeklyPerformance(trades: { profit_loss: number; close_time: string }[]) {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  startOfWeek.setHours(0, 0, 0, 0)
  const weekTrades = trades.filter(t => new Date(t.close_time) >= startOfWeek)
  const totalPL = weekTrades.reduce((sum, t) => sum + t.profit_loss, 0)
  const wins = weekTrades.filter(t => t.profit_loss > 0).length
  return { trades: weekTrades.length, totalPL, wins, winRate: weekTrades.length > 0 ? (wins / weekTrades.length) * 100 : 0 }
}

// Helper: Get pip value and contract size for different instruments
// Based on global forex industry standards
type InstrumentType = 'JPY_PAIR' | 'GOLD' | 'INDICES' | 'CRYPTO' | 'STANDARD'

function getInstrumentInfo(symbol: string): { 
  pipSize: number 
  contractSize: number 
  type: InstrumentType
  pipValueUSD: number // Value of 1 pip in USD for 1 standard lot
} {
  const sym = symbol.toUpperCase()
  
  // JPY Pairs (2 decimal places for price, 0.01 pip size)
  // Standard: 1 pip = 0.01, 1 lot = 100,000 JPY
  // USD per pip ≈ $6-10 depending on current USD/JPY rate
  if (sym.includes('JPY')) {
    return { 
      pipSize: 0.01, 
      contractSize: 100000, 
      type: 'JPY_PAIR',
      pipValueUSD: 9.09 // Approx: 100,000 JPY ÷ 110 (typical USD/JPY rate)
    }
  }
  
  // Gold (XAUUSD) - Industry Standard
  // 1 lot = 100 troy ounces, 1 pip = $0.10 (not $0.01)
  // Most brokers: 0.10 price movement = $10 profit/loss per lot
  if (sym.includes('XAU') || sym.includes('GOLD')) {
    return { 
      pipSize: 0.10, // Standard is 0.10, not 0.01
      contractSize: 100, // 100 oz per standard lot
      type: 'GOLD',
      pipValueUSD: 10 // 0.10 × 100 oz = $10 per pip per lot
    }
  }
  
  // Silver (XAGUSD)
  if (sym.includes('XAG') || sym.includes('SILVER')) {
    return { 
      pipSize: 0.001, 
      contractSize: 5000, // 5,000 oz per standard lot
      type: 'GOLD',
      pipValueUSD: 5 // 0.001 × 5,000 oz = $5 per pip per lot
    }
  }
  
  // Indices - Contract sizes vary by broker
  // US30 (Dow Jones): 1 point = $1 per contract
  if (sym.includes('US30') || sym.includes('DOW') || sym.includes('DJ30')) {
    return { 
      pipSize: 1, 
      contractSize: 1, // $1 per point
      type: 'INDICES',
      pipValueUSD: 1
    }
  }
  // NAS100 (Nasdaq 100): 1 point = $0.20 or $1 depending on broker
  if (sym.includes('NAS100') || sym.includes('NAS') || sym.includes('NDX')) {
    return { 
      pipSize: 0.25, // Many brokers use 0.25
      contractSize: 20, // $20 per point
      type: 'INDICES',
      pipValueUSD: 5 // 0.25 × 20 = $5 per pip per lot
    }
  }
  // SP500 (S&P 500): 1 point = $0.50 or $1 depending on broker
  if (sym.includes('SP500') || sym.includes('S&P') || sym.includes('US500')) {
    return { 
      pipSize: 0.25, 
      contractSize: 50, // $50 per point
      type: 'INDICES',
      pipValueUSD: 12.5 // 0.25 × 50 = $12.50 per pip per lot
    }
  }
  
  // Crypto - Contract sizes vary widely
  if (sym.includes('BTC') || sym.includes('BITCOIN')) {
    return { 
      pipSize: 1, 
      contractSize: 1, // 1 BTC per lot
      type: 'CRYPTO',
      pipValueUSD: 1 // $1 per $1 price movement
    }
  }
  if (sym.includes('ETH') || sym.includes('ETHEREUM')) {
    return { 
      pipSize: 0.01, 
      contractSize: 10, // 10 ETH per lot
      type: 'CRYPTO',
      pipValueUSD: 0.10 // 0.01 × 10 = $0.10 per pip per lot
    }
  }
  
  // Standard Forex Pairs (EURUSD, GBPUSD, AUDUSD, NZDUSD, etc.)
  // Industry standard: 1 pip = 0.0001, 1 lot = 100,000 units
  // For USD quote pairs: 1 pip = $10 per standard lot
  return { 
    pipSize: 0.0001, 
    contractSize: 100000, 
    type: 'STANDARD',
    pipValueUSD: 10 // Standard: 0.0001 × 100,000 = $10 per pip per lot
  }
}

// Helper: Calculate P/L based on global industry standards
// Standard lot = 100,000 units for most forex pairs
// Different contract sizes for other instruments
export function calculateForexProfitLoss(
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  type: 'BUY' | 'SELL',
  symbol: string
): number {
  const info = getInstrumentInfo(symbol)
  
  // Calculate price difference based on trade type
  let priceDiff = 0
  if (type === 'BUY') {
    priceDiff = exitPrice - entryPrice
  } else {
    priceDiff = entryPrice - exitPrice
  }
  
  let profit = 0
  
  switch (info.type) {
    case 'GOLD':
      // Gold (XAUUSD): Standard = 0.10 pip = $10 per lot
      // Profit = Price Difference × Lot Size × Contract Size
      profit = priceDiff * lotSize * info.contractSize
      break
      
    case 'JPY_PAIR':
      // JPY pairs: 1 pip = 0.01, 1 lot = 100,000 JPY
      // For USD account, convert JPY to USD (approximate)
      // Using estimated rate of 110 JPY/USD
      profit = (priceDiff * lotSize * info.contractSize) / 110
      break
      
    case 'INDICES':
      // Indices: Each has its own contract size and pip value
      profit = priceDiff * lotSize * info.contractSize
      break
      
    case 'CRYPTO':
      // Crypto: Contract sizes vary
      profit = priceDiff * lotSize * info.contractSize
      break
      
    case 'STANDARD':
    default:
      // Standard forex pairs (EURUSD, GBPUSD, etc.)
      // 1 pip = 0.0001 = $10 per standard lot
      // Formula: (Exit - Entry) × Lot Size × 100,000
      profit = priceDiff * lotSize * info.contractSize
      break
  }
  
  // Round to 2 decimal places
  return Math.round(profit * 100) / 100
}

// Helper: Get pip value description for display
export function getPipInfo(symbol: string): { description: string; example: string; pipValue: string } {
  const info = getInstrumentInfo(symbol)
  
  switch (info.type) {
    case 'GOLD':
      return {
        description: '1 pip = $0.10',
        example: '100 oz contract',
        pipValue: `$${info.pipValueUSD} per pip/lot`
      }
    case 'JPY_PAIR':
      return {
        description: '1 pip = 0.01',
        example: '100,000 JPY contract',
        pipValue: `~$${info.pipValueUSD.toFixed(2)} per pip/lot`
      }
    case 'INDICES':
      return {
        description: `1 point = $${info.pipValueUSD}`,
        example: 'Index points',
        pipValue: `$${info.pipValueUSD} per pip/lot`
      }
    case 'CRYPTO':
      return {
        description: `1 pip = $${info.pipSize}`,
        example: 'Per unit',
        pipValue: `$${info.pipValueUSD} per pip/lot`
      }
    default:
      return {
        description: '1 pip = 0.0001',
        example: '100,000 units contract',
        pipValue: `$${info.pipValueUSD} per pip/lot`
      }
  }
}
