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
  { value: 'neutral', label: 'Neutral', icon: 'Meh', color: 'text-purple-400' },
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

// Helper: Get pip value and contract size for different instruments
type InstrumentType = 'JPY_PAIR' | 'GOLD' | 'INDICES' | 'CRYPTO' | 'STANDARD'

function getInstrumentInfo(symbol: string): { pipSize: number; contractSize: number; type: InstrumentType } {
  const sym = symbol.toUpperCase()
  
  // JPY Pairs (2 decimal places)
  if (sym.includes('JPY')) {
    return { pipSize: 0.01, contractSize: 100000, type: 'JPY_PAIR' }
  }
  
  // Gold (XAUUSD) - special handling
  if (sym.includes('XAU') || sym.includes('GOLD')) {
    // Gold: 1 lot = 100 oz, price in USD/oz
    // Pip size typically 0.01 or 0.1 depending on broker
    return { pipSize: 0.01, contractSize: 100, type: 'GOLD' }
  }
  
  // Silver (XAGUSD)
  if (sym.includes('XAG') || sym.includes('SILVER')) {
    return { pipSize: 0.001, contractSize: 5000, type: 'GOLD' }
  }
  
  // Indices (US30, NAS100, etc.)
  if (sym.includes('US30') || sym.includes('DOW') || sym.includes('DJ30')) {
    return { pipSize: 1, contractSize: 10, type: 'INDICES' }
  }
  if (sym.includes('NAS100') || sym.includes('NAS') || sym.includes('NDX')) {
    return { pipSize: 0.25, contractSize: 20, type: 'INDICES' }
  }
  if (sym.includes('SP500') || sym.includes('S&P') || sym.includes('US500')) {
    return { pipSize: 0.25, contractSize: 50, type: 'INDICES' }
  }
  
  // Crypto (BTC, ETH, etc.)
  if (sym.includes('BTC') || sym.includes('BITCOIN')) {
    return { pipSize: 1, contractSize: 1, type: 'CRYPTO' }
  }
  if (sym.includes('ETH') || sym.includes('ETHEREUM')) {
    return { pipSize: 0.01, contractSize: 10, type: 'CRYPTO' }
  }
  
  // Standard Forex Pairs (EURUSD, GBPUSD, etc.)
  return { pipSize: 0.0001, contractSize: 100000, type: 'STANDARD' }
}

// Helper: Calculate P/L based on forex standard lots
// Standard lot = 100,000 units for forex
// Different contract sizes for other instruments
export function calculateForexProfitLoss(
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  type: 'BUY' | 'SELL',
  symbol: string
): number {
  const info = getInstrumentInfo(symbol)
  
  let priceDiff = 0
  if (type === 'BUY') {
    priceDiff = exitPrice - entryPrice
  } else {
    priceDiff = entryPrice - exitPrice
  }
  
  let profit = 0
  
  switch (info.type) {
    case 'GOLD':
      // Gold: 1 lot = 100 oz
      // Profit = (Exit - Entry) × Lots × 100
      profit = priceDiff * lotSize * info.contractSize
      break
      
    case 'JPY_PAIR':
      // JPY pairs: 1 lot = 100,000 units
      // But pip value is different (0.01 instead of 0.0001)
      // For USD account, need to convert
      profit = priceDiff * lotSize * info.contractSize
      break
      
    case 'INDICES':
      // Indices have their own contract sizes
      profit = priceDiff * lotSize * info.contractSize
      break
      
    case 'CRYPTO':
      // Crypto: 1 lot = 1 unit (usually)
      profit = priceDiff * lotSize * info.contractSize
      break
      
    case 'STANDARD':
    default:
      // Standard forex pairs: 1 lot = 100,000 units
      profit = priceDiff * lotSize * info.contractSize
      break
  }
  
  // Round to 2 decimal places
  return Math.round(profit * 100) / 100
}

// Helper: Get pip value description for display
export function getPipInfo(symbol: string): { description: string; example: string } {
  const info = getInstrumentInfo(symbol)
  
  switch (info.type) {
    case 'GOLD':
      return {
        description: '1 pip = $0.01 per oz',
        example: '100 oz contract'
      }
    case 'JPY_PAIR':
      return {
        description: '1 pip = 0.01',
        example: '100,000 JPY contract'
      }
    case 'INDICES':
      return {
        description: `1 point = $${info.contractSize}`,
        example: 'Index points'
      }
    case 'CRYPTO':
      return {
        description: '1 pip = $1',
        example: 'Per unit'
      }
    default:
      return {
        description: '1 pip = 0.0001',
        example: '100,000 units contract'
      }
  }
}
