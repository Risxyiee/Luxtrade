/**
 * ============================================================
 * forex-cache — cache harga/candle bersama (dipakai /api/forex
 * dan /api/forex-batch) — FASE 2 PERF
 * ============================================================
 * Dua lapis cache:
 *   1. In-memory Map (per-isolate, TTL per-interval, LRU 100)
 *   2. Cloudflare KV `luxtradee_kv` (cross-isolate)
 * Aturan freshness: harga live (limit<=1) hanya disajikan dari
 * cache bila usia <= 15 detik — polling alert tetap responsif
 * tanpa memukul Yahoo untuk setiap user/simbol.
 */

import { validatePrice } from '@/lib/market/yahoo'

export interface CacheEntry { data: any[]; timestamp: number; source: string }

const cache = new Map<string, CacheEntry>()
export const CACHE_TTL_DEFAULT = 5 * 60 * 1000   // 5 menit (data chart)
export const CACHE_TTL_SHORT = 1 * 60 * 1000     // 1 menit utk M5/M15
export const CACHE_TTL_PRICE = 30 * 1000         // 30 detik utk limit=1
export const PRICE_FRESH_MS = 15 * 1000          // harga live > 15 dtk = wajib refetch

// ── Price sanity validation (filter array candle, pakai validatePrice bersama) ──
export function validateCandles(symbol: string, candles: any[]): any[] {
  return candles.filter(candle => {
    const validClose = validatePrice(symbol, candle.close)
    if (validClose === null) return false
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0) return false
    if (candle.high < candle.low) return false
    return true
  })
}

export function getCacheTtl(interval: string, limit: number): number {
  if (limit <= 1) return CACHE_TTL_PRICE
  if (interval === '5m' || interval === '15m') return CACHE_TTL_SHORT
  return CACHE_TTL_DEFAULT
}

export function getKvTtlSeconds(interval: string, limit: number): number {
  return limit <= 1 ? 30 : (interval === '5m' || interval === '15m') ? 60 : 300
}

export function getCached(key: string, interval: string, limit: number): CacheEntry | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < getCacheTtl(interval, limit)) {
    const symbol = key.split(':')[0]
    const validatedData = validateCandles(symbol, entry.data)
    if (validatedData.length === 0 && entry.data.length > 0) {
      console.warn(`[Forex] Cache entry for ${key} failed sanity validation — invalidating`)
      cache.delete(key)
      return null
    }
    if (validatedData.length < entry.data.length) {
      entry.data = validatedData
    }
    return entry
  }
  cache.delete(key)
  return null
}

export function setCache(key: string, data: any[], source: string) {
  cache.set(key, { data, timestamp: Date.now(), source })
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

/** Paksa hapus entry mem-cache (mis. price check butuh data lebih segar dari TTL) */
export function deleteCached(key: string) {
  cache.delete(key)
}

// ── KV cache helpers (cross-isolate cache on CF Workers) ─────────────
export async function getForexKVCache(key: string): Promise<CacheEntry | null> {
  try {
    let kv: any = null
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = getCloudflareContext()
      kv = (ctx as any)?.env?.luxtradee_kv
    } catch {}
    if (!kv) return null
    const raw = await kv.get(`forex:${key}`, 'text')
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry

    const symbol = key.split(':')[0]
    const validatedData = validateCandles(symbol, entry.data)
    if (validatedData.length === 0 && entry.data.length > 0) {
      console.warn(`[Forex] KV cache entry for ${key} failed sanity validation — skipping`)
      return null
    }
    if (validatedData.length < entry.data.length) {
      entry.data = validatedData
    }
    return entry
  } catch {
    return null
  }
}

export async function setForexKVCache(key: string, data: any[], source: string, ttlSeconds: number): Promise<void> {
  try {
    let kv: any = null
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = getCloudflareContext()
      kv = (ctx as any)?.env?.luxtradee_kv
    } catch {}
    if (!kv) return
    const entry: CacheEntry = { data, timestamp: Date.now(), source }
    await kv.put(`forex:${key}`, JSON.stringify(entry), { expirationTtl: ttlSeconds })
  } catch {
    // KV not available, skip
  }
}
