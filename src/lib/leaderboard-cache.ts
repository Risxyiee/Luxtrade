// In-memory cache for leaderboard API
// Key: "period|sortBy" → { data, timestamp }
const leaderboardCache = new Map<string, { data: any[]; timestamp: number }>()
const CACHE_TTL = 30 * 1000 // 30 seconds

export function getLeaderboardCache() {
  return leaderboardCache
}

export function clearLeaderboardCache() {
  leaderboardCache.clear()
}

export function getCachedLeaderboard(cacheKey: string) {
  const cached = leaderboardCache.get(cacheKey)
  const now = Date.now()
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

export function setCachedLeaderboard(cacheKey: string, data: any[]) {
  leaderboardCache.set(cacheKey, { data, timestamp: Date.now() })
}

export const CACHE_TTL_VALUE = CACHE_TTL