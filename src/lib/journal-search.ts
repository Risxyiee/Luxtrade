/**
 * Journal Search and Filter Utilities
 */

export interface JournalEntry {
  id: string
  title: string
  content: string
  mood?: string | null
  market_condition?: string | null
  tags?: string | null
  created_at: string
  linked_journal_id?: string | null
  user_id?: string
  image_url?: string | null
  linked_trades_count?: number
  updated_at?: string
}

export interface JournalFilters {
  searchQuery?: string
  mood?: string
  marketCondition?: string
  tags?: string[]
  dateFrom?: Date
  dateTo?: Date
  linkedSymbol?: string
}

/**
 * Filter journal entries based on multiple criteria
 */
export function filterJournalEntries(entries: JournalEntry[], filters: JournalFilters): JournalEntry[] {
  return entries.filter(entry => {
    // Search in title and content
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const matchesTitle = entry.title.toLowerCase().includes(query)
      const matchesContent = entry.content.toLowerCase().includes(query)
      if (!matchesTitle && !matchesContent) return false
    }

    // Filter by mood
    if (filters.mood && entry.mood !== filters.mood) {
      return false
    }

    // Filter by market condition
    if (filters.marketCondition && entry.market_condition !== filters.marketCondition) {
      return false
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      const entryTags = entry.tags ? entry.tags.split(',').map(t => t.trim().toLowerCase()) : []
      const hasAnyTag = filters.tags.some(tag => entryTags.includes(tag.toLowerCase()))
      if (!hasAnyTag) return false
    }

    // Filter by date range
    if (filters.dateFrom || filters.dateTo) {
      const entryDate = new Date(entry.created_at)
      entryDate.setHours(0, 0, 0, 0)
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        if (entryDate < fromDate) return false
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (entryDate > toDate) return false
      }
    }

    return true
  })
}

/**
 * Get unique values for filter options
 */
export function getFilterOptions(entries: JournalEntry[]) {
  const moods = new Set<string>()
  const marketConditions = new Set<string>()
  const allTags = new Set<string>()

  entries.forEach(entry => {
    if (entry.mood) moods.add(entry.mood)
    if (entry.market_condition) marketConditions.add(entry.market_condition)
    if (entry.tags) {
      entry.tags.split(',').forEach(tag => {
        allTags.add(tag.trim())
      })
    }
  })

  return {
    moods: Array.from(moods).sort(),
    marketConditions: Array.from(marketConditions).sort(),
    tags: Array.from(allTags).sort()
  }
}

/**
 * Calculate journal statistics
 */
export function calculateJournalStats(entries: JournalEntry[]) {
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      moodDistribution: { confident: 0, neutral: 0, anxious: 0 },
      longestStreak: 0,
      currentStreak: 0,
      daysActive: 0,
      avgWordsPerEntry: 0
    }
  }

  // Mood distribution
  const moodDistribution = { confident: 0, neutral: 0, anxious: 0 }
  let totalWords = 0

  entries.forEach(entry => {
    if (entry.mood === 'confident') moodDistribution.confident++
    else if (entry.mood === 'neutral') moodDistribution.neutral++
    else if (entry.mood === 'anxious') moodDistribution.anxious++
    
    totalWords += entry.content.split(/\s+/).length
  })

  // Calculate streaks and days active
  const uniqueDates = [...new Set(entries.map(e => new Date(e.created_at).toDateString()))]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  let longestStreak = 0
  let currentStreak = 0

  if (uniqueDates.length > 0) {
    // Calculate current streak
    const firstDate = new Date(uniqueDates[0])
    firstDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const diffDays = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 1) {
      currentStreak = 1
      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = new Date(uniqueDates[i - 1])
        const curr = new Date(uniqueDates[i])
        prev.setHours(0, 0, 0, 0)
        curr.setHours(0, 0, 0, 0)
        if (Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)) === 1) {
          currentStreak++
        } else break
      }
    }

    // Calculate longest streak
    let tempStreak = 1
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1])
      const curr = new Date(uniqueDates[i])
      prev.setHours(0, 0, 0, 0)
      curr.setHours(0, 0, 0, 0)

      if (Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)) === 1) {
        tempStreak++
      } else {
        longestStreak = Math.max(longestStreak, tempStreak)
        tempStreak = 1
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)
  }

  return {
    totalEntries: entries.length,
    moodDistribution,
    longestStreak,
    currentStreak,
    daysActive: uniqueDates.length,
    avgWordsPerEntry: Math.round(totalWords / entries.length)
  }
}
