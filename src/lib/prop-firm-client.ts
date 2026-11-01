'use client'

/**
 * Shared client /api/prop-firm-guard — dedupe fetch identik.
 *
 * PERF (laporan Bos: masuk dashboard terasa berat): DashboardTab,
 * PropFirmGuardSummary, dan EquityCurveCard minta data IDENTIK saat mount →
 * dulu 3 request + 3 roundtrip auth tiap kali masuk dashboard. Sekarang:
 * cache 30 detik + in-flight dedupe → 1 request dibagi ke semua pemanggil.
 * `force: true` untuk refresh setelah mutasi (event 'propfirm-data-changed').
 */
import { authFetch } from '@/lib/api-fetch'

export interface PropFirmGuardData {
  challenges?: any[]
  [key: string]: any
}

const TTL_MS = 30_000
let cache: { data: PropFirmGuardData; at: number } | null = null
let inflight: Promise<PropFirmGuardData> | null = null

export function fetchPropFirmGuard(opts?: { force?: boolean }): Promise<PropFirmGuardData> {
  const force = !!opts?.force
  if (!force) {
    if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.data)
    if (inflight) return inflight
  }
  inflight = authFetch('/api/prop-firm-guard', { cache: 'no-store' })
    .then(async res => {
      const data: PropFirmGuardData = res.ok ? await res.json().catch(() => ({})) : {}
      cache = { data, at: Date.now() }
      return data
    })
    .finally(() => { inflight = null })
  return inflight
}

/** Buang cache — pakai setelah mutasi challenge supaya fetch berikutnya fresh. */
export function invalidatePropFirmGuard(): void {
  cache = null
}
