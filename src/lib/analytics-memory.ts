// Shared in-memory analytics data
// This module is imported by both /api/track and /api/analytics/traffic
// to share the same data instance

export const analyticsData = {
  pageViews: 0,
  uniqueVisitors: new Set<string>(),
  deviceStats: { Mobile: 0, Tablet: 0, Desktop: 0, Unknown: 0 },
  browserStats: { Chrome: 0, Safari: 0, Firefox: 0, Edge: 0, Opera: 0, Other: 0, Unknown: 0 },
  osStats: { Windows: 0, macOS: 0, Linux: 0, Android: 0, iOS: 0, Other: 0, Unknown: 0 },
  topPages: new Map<string, number>(),
  recentVisits: [] as Array<{
    path: string
    referrer: string | null
    device: string
    browser: string
    os: string
    ip: string
    createdAt: Date
  }>,
}

// Keep only recent visits to prevent memory bloat
const MAX_VISITS_TO_STORE = 10000
const DAYS_TO_KEEP = 90

export function cleanupOldVisits() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP)

  while (analyticsData.recentVisits.length > MAX_VISITS_TO_STORE) {
    analyticsData.recentVisits.shift()
  }

  analyticsData.recentVisits = analyticsData.recentVisits.filter(
    v => v.createdAt >= cutoff
  )

  // Also cleanup unique visitors set periodically
  if (analyticsData.uniqueVisitors.size > 50000) {
    const recentIPs = new Set(analyticsData.recentVisits.map(v => v.ip))
    analyticsData.uniqueVisitors = recentIPs
  }
}
