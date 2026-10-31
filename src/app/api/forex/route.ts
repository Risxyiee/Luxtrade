/**
 * ============================================================
 * GET /api/forex — candle OHLC forex / gold / US100 (keyless)
 * ============================================================
 * DIPAKAI OLEH: WatchlistTab (polling harga limit=1) & panel lain.
 * Datafeed CHART VELA lewat /api/candles — juga Yahoo keyless
 * (Task 42: seluruh datafeed 100% keyless, tanpa API keyed).
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
  fetchYahooChart,
  type YahooCandle,
} from '@/lib/market/yahoo'
// PERF (F2): cache dipindah ke lib bersama agar /api/forex-batch memakai
// lapisan cache yang SAMA (mem + KV) — satu polling batch memanaskan
// cache untuk semua user, bukan N×user hit ke Yahoo.
import {
  getCached,
  setCache,
  deleteCached,
  getForexKVCache,
  setForexKVCache,
  getCacheTtl,
  getKvTtlSeconds,
  PRICE_FRESH_MS,
} from '@/lib/market/forex-cache'

export const dynamic = 'force-dynamic'

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

    const kvTtlSeconds = getKvTtlSeconds(interval, limit)

    // Cache in-memory (kecuali nocache; price check selalu minta yang freshest)
    if (!nocache) {
      const cached = getCached(cacheKey, interval, limit)
      if (cached) {
        const age = Date.now() - cached.timestamp
        if (isPriceCheck && age > PRICE_FRESH_MS) {
          deleteCached(cacheKey) // price check perlu data segar
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
        if (!(isPriceCheck && kvAge > PRICE_FRESH_MS)) {
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
