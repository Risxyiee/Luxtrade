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

// Helper: Calculate P/L based on forex standard lots
// Standard lot = 100,000 units
// Mini lot = 10,000 units  (0.1 lot)
// Micro lot = 1,000 units  (0.01 lot)
// Nano lot = 100 units     (0.001 lot)
export function calculateForexProfitLoss(
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  type: 'BUY' | 'SELL',
  symbol: string
): number {
  // Check if it's a JPY pair (2 decimal places vs 5)
  const isJPY = symbol.toUpperCase().includes('JPY')
  
  // For JPY pairs: 1 pip = 0.01
  // For other pairs: 1 pip = 0.0001
  const pipValue = isJPY ? 0.01 : 0.0001
  
  // Standard lot multiplier (100,000 units for standard)
  // 1.0 lot = 100,000 units
  const lotMultiplier = lotSize * 100000
  
  let priceDiff = 0
  if (type === 'BUY') {
    priceDiff = exitPrice - entryPrice
  } else {
    priceDiff = entryPrice - exitPrice
  }
  
  // Calculate profit in base currency (for most pairs it's USD)
  // For simplicity, we're assuming USD account
  const profit = priceDiff * lotMultiplier
  
  // Round to 2 decimal places
  return Math.round(profit * 100) / 100
}
