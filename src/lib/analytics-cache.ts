/**
 * Cache analitik di memori (dipakai GET /api/analytics + invalidasi
 * setelah mutasi trade/account).
 *
 * CATATAN FASE 4: sebelumnya fungsi-fungsi ini hidup di
 * src/app/api/analytics/route.ts dan diimpor lintas-route. Next.js 16
 * App Router hanya mengizinkan route file mengekspor HTTP handler +
 * config — ekspor lain membuat type-check build gagal
 * (".next/types/...: Property is not assignable to type 'never'").
 * Karena itu cache dipindah ke lib bersama ini.
 */

// In-memory cache keyed by userId+period
// PERF (F2): TTL 10s → 60s. Keamanan stale tetap terjaga karena
// invalidateAnalyticsCache(userId) dipanggil via runInBackground pada SETIAP
// POST/PUT/DELETE /api/trades — mutasi selalu membuang cache tepat waktu.
const analyticsCache = new Map<string, { data: any; expiry: number }>()
export const ANALYTICS_CACHE_TTL = 60_000 // 60 seconds

export function getAnalyticsCacheKey(userId: string, period: string, accountId: string | null) {
  return `${userId}:${period}:${accountId || 'all'}`
}

export function getAnalyticsCache(key: string) {
  return analyticsCache.get(key)
}

export function setAnalyticsCache(key: string, data: any) {
  analyticsCache.set(key, { data, expiry: Date.now() + ANALYTICS_CACHE_TTL })
}

/** Invalidate all cached analytics for a given user (call after trade/account mutations) */
export function invalidateAnalyticsCache(userId: string) {
  for (const key of analyticsCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      analyticsCache.delete(key)
    }
  }
}
