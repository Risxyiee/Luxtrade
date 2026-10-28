/**
 * ============================================================
 * GET /api/forex — candle OHLC forex / gold / US100 (keyless)
 * ============================================================
 * DIPAKAI OLEH: WatchlistTab (polling harga limit=1) & panel lain.
 * Datafeed CHART VELA kini lewat /api/candles (Twelve Data
 * primary + fallback route ini tetap Yahoo keyless).
 *
 * SATU SUMBER DATA: Yahoo Finance chart API (publik, GRATIS,
 * TANPA API KEY) → mustahil kena 401 Unauthorized. Logika fetch
 * bersama ada di src/lib/market/yahoo.ts (dipakai juga oleh
 * /api/candles sebagai fallback).
 *
 * Fitur:
 *   - Alias simbol (GOLD→XAUUSD, NASDAQ→US100, "XAU/USD", dst.)
 *   - Sanity check harga (XAU < 2000 / US100 di luar rentang → reject)
 *   - Cache in-memory (TTL per-interval) + KV Cloudflare (cross-isolate)
 *   - Live tick utk polling harga (limit=1): regularMarketPrice Yahoo
 *   - Respons jujur 503 tanpa mock bila gagal
 *
 * Kontrak respons (tidak berubah):
 *   { success, symbol, interval, data: [{time,open,high,low,close}], source, fetchedAt }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  FOREX_SYMBOLS,
  normalizeSymbol,
  validatePrice,
  fetchYahooChart,
  type YahooCandle,
} from '@/lib/market/yahoo'

export const dynamic = 'force-dynamic'

// ── Price sanity validation (filter array candle, pakai validatePrice bersama) ──
function validateCandles(symbol: string, candles: any[]): any[] {
  return candles.filter(candle => {
    const validClose = validatePrice(symbol, candle.close)
    if (validClose === null) return false
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0) return false
    if (candle.high < candle.low) return false
    return true
  })
}

// ── In-memory cache with per-interval TTL ────────────────────────────
interface CacheEntry { data: any[]; timestamp: number; source: string }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_DEFAULT = 5 * 60 * 1000   // 5 minutes (chart data)
const CACHE_TTL_SHORT = 1 * 60 * 1000     // 1 minute for M5/M15
const CACHE_TTL_PRICE = 30 * 1000         // 30 seconds for limit=1 (price checks)

function getCacheTtl(interval: string, limit: number): number {
  if (limit <= 1) return CACHE_TTL_PRICE
  if (interval === '5m' || interval === '15m') return CACHE_TTL_SHORT
  return CACHE_TTL_DEFAULT
}

function getCached(key: string, interval: string, limit: number): CacheEntry | null {
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

function setCache(key: string, data: any[], source: string) {
  cache.set(key, { data, timestamp: Date.now(), source })
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

// ── KV cache helpers (cross-isolate cache on CF Workers) ─────────────
async function getForexKVCache(key: string): Promise<CacheEntry | null> {
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

async function setForexKVCache(key: string, data: any[], source: string, ttlSeconds: number): Promise<void> {
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

// ── Main handler ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSymbol = searchParams.get('symbol') || 'EURUSD'
    const interval = searchParams.get('interval') || '1h'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 300)
    const nocache = searchParams.get('nocache') === 'true'
    const isPriceCheck = limit <= 1

    // Normalize symbol (e.g., "XAU" → "XAUUSD", "NASDAQ" → "US100")
    const symbol = normalizeSymbol(rawSymbol)

    if (!FOREX_SYMBOLS[symbol]) {
      console.warn(`[Forex] Unsupported symbol: "${rawSymbol}" → normalized to "${symbol}"`)
      return NextResponse.json({
        success: false,
        symbol,
        interval,
        data: [],
        source: 'unsupported',
        unavailable: true,
        message: `Simbol "${rawSymbol}" tidak didukung. Simbol yang tersedia: ${Object.keys(FOREX_SYMBOLS).join(', ')}`,
        fetchedAt: new Date().toISOString(),
      }, { status: 400 })
    }
    const validSymbol = symbol
    const cacheKey = `${validSymbol}:${interval}:${limit}`

    const kvTtlSeconds = isPriceCheck ? 30 : (interval === '5m' || interval === '15m') ? 60 : 300

    // Cache in-memory (kecuali nocache; price check selalu minta yang freshest)
    if (!nocache) {
      const cached = getCached(cacheKey, interval, limit)
      if (cached) {
        const age = Date.now() - cached.timestamp
        if (isPriceCheck && age > 15000) {
          cache.delete(cacheKey) // price check perlu data segar
        } else {
          return NextResponse.json({
            success: true,
            symbol: validSymbol,
            interval,
            data: cached.data,
            source: cached.source + '-memcache',
            fetchedAt: new Date(cached.timestamp).toISOString(),
            stale: false,
          })
        }
      }

      // KV cache (cross-isolate on CF Workers)
      const kvCached = await getForexKVCache(cacheKey)
      if (kvCached && Date.now() - kvCached.timestamp < getCacheTtl(interval, limit)) {
        const kvAge = Date.now() - kvCached.timestamp
        if (!(isPriceCheck && kvAge > 15000)) {
          setCache(cacheKey, kvCached.data, kvCached.source)
          return NextResponse.json({
            success: true,
            symbol: validSymbol,
            interval,
            data: kvCached.data,
            source: kvCached.source + '-kvcache',
            fetchedAt: new Date(kvCached.timestamp).toISOString(),
            stale: false,
          })
        }
      }
    }

    // YAHOO — satu-satunya sumber (publik, tanpa API key → tanpa risiko 401)
    // limit<=1 → liveTick aktif (regularMarketPrice sbg harga real-time)
    const yf: YahooCandle[] | null = await fetchYahooChart(validSymbol, interval, limit, isPriceCheck)
    if (yf && yf.length > 0) {
      setCache(cacheKey, yf, 'yahoo-finance')
      await setForexKVCache(cacheKey, yf, 'yahoo-finance', kvTtlSeconds)
      console.log(`[Forex] ✓ ${yf.length} candles from Yahoo Finance (${validSymbol} ${interval})`)
      return NextResponse.json({
        success: true,
        symbol: validSymbol,
        interval,
        data: yf,
        source: 'yahoo-finance',
        fetchedAt: new Date().toISOString(),
      })
    }

    // SUMBER GAGAL — respons jujur (TANPA mock data)
    console.error(`[Forex] ❌ Yahoo Finance gagal untuk ${validSymbol} ${interval}`)
    return NextResponse.json({
      success: false,
      symbol: validSymbol,
      interval,
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: `Data live untuk ${validSymbol} sedang tidak dapat diakses dari Yahoo Finance. Coba beberapa menit lagi.`,
      fetchedAt: new Date().toISOString(),
    }, { status: 503 })
  } catch (error) {
    console.error(`[Forex] ❌ Unhandled error:`, error)
    return NextResponse.json({
      success: false,
      symbol: new URL(request.url).searchParams.get('symbol') || 'EURUSD',
      interval: new URL(request.url).searchParams.get('interval') || '1h',
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: 'Data live sedang tidak dapat diakses. Terjadi kesalahan internal. Coba beberapa menit lagi.',
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString(),
    }, { status: 503 })
  }
}
