// Helper: Format date to local timezone (YYYY-MM-DD HH:mm:ss)
export function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Helper: Convert datetime-local value to local format
export function datetimeLocalToFormat(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  return formatLocalDateTime(date)
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
