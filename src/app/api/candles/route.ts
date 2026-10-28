/**
 * ============================================================
 * GET /api/candles — datafeed chart Vela (forex, gold, US100, crypto)
 * ============================================================
 * RANTAI SUMBER (urutan Bos: TradingView dulu, BINANCE DIBUANG):
 *
 *   0. TRADING VIEW (websocket publik, KEYLESS) — grade broker
 *      (OANDA:XAUUSD, BINANCE:BTCUSDT utk crypto). Sudah diverifikasi
 *      hidup dari infra kita. Gagal/timeout → lanjut ke bawah.
 *
 *   1. FINNHUB (process.env.FINNHUB_API_KEY) — API resmi, tanpa
 *      key → skip diam.
 *
 *   2. TWELVE DATA (process.env.TWELVE_DATA_API_KEY) — candle
 *      SPOT XAU/USD, XAG/USD, forex major & NDX. Level harga
 *      paling mendekati feed broker (OANDA/MT4/MT5). Free tier
 *      8 req/min → rate limiter + cache ketat di lib twelvedata.
 *      TANPA key / quota habis / plan tak mencakup → NULL dan
 *      lanjut ke sumber di bawah (UI tidak pernah 401).
 *
 *   3. YAHOO Finance chart API (publik, GRATIS, TANPA API KEY)
 *      — fallback host otomatis query1 → query2. Selalu hidup.
 *      Crypto (BTCUSDT → BTC-USD) juga dilayani Yahoo.
 *
 * Pemetaan simbol (kanonik Luxtradee):
 *   Gold    : XAUUSD  (TD XAU/USD spot → Yahoo GC=F)
 *   Silver  : XAGUSD  (TD XAG/USD spot → Yahoo SI=F)
 *   Nasdaq  : US100   (TD NDX → Yahoo NQ=F futures; alias
 *                      NAS100/NASDAQ/NDX dinormalisasi masuk sini.
 *                      QQQ TIDAK dipakai — level ~$490 vs NDX ~21rb
 *                      merusak skala chart)
 *   Forex   : EURUSD, GBPUSD, USDJPY, dst. (TD EUR/USD → Yahoo …=X)
 *
 * Interval kanonik: 5m · 15m · 30m · 1h · 2h · 4h · 1d · 1w
 *   (2h/4h diagregasi dari 1h oleh lib bersama market/yahoo.ts)
 *
 * Konversi keluaran → OHLCV standar Vela:
 *   { time: epoch DETIK, open, high, low, close, volume? }
 *
 * Cache: in-memory (TTL per-interval) + KV Cloudflare (cross-isolate)
 *
 * Kontrak respons (sama dengan /api/forex):
 *   { success, symbol, interval, data: [{time,open,high,low,close,volume?}], source, fetchedAt }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  FOREX_SYMBOLS,
  normalizeSymbol,
  fetchYahooChart,
  type YahooCandle,
} from '@/lib/market/yahoo'
import { fetchTwelveDataCandles } from '@/lib/market/twelvedata'
import { fetchTradingViewCandles } from '@/lib/market/tradingview'
import { fetchFinnhubCandles } from '@/lib/market/finnhub'

export const dynamic = 'force-dynamic'

/* Interval kanonik + format Vela ('60','240','1D',…) */
const INTERVALS: Record<string, string> = {
  '5m': '5m', '5': '5m',
  '15m': '15m', '15': '15m',
  '30m': '30m', '30': '30m',
  '1h': '1h', '60': '1h',
  '2h': '2h', '120': '2h',
  '4h': '4h', '240': '4h',
  '1d': '1d', '1D': '1d', 'D': '1d', '1440': '1d',
  '1w': '1w', '1W': '1w', 'W': '1w', '10080': '1w',
}

/* ============================================================
   CACHE in-memory + KV Cloudflare
   ============================================================ */
interface CacheEntry { data: Ohlcv[]; timestamp: number; source: string }
type Ohlcv = YahooCandle

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_DEFAULT = 5 * 60 * 1000
const CACHE_TTL_SHORT = 60 * 1000 // 5m/15m
const CACHE_TTL_PRICE = 30 * 1000

function getCacheTtl(interval: string, limit: number): number {
  if (limit <= 1) return CACHE_TTL_PRICE
  if (interval === '5m' || interval === '15m') return CACHE_TTL_SHORT
  return CACHE_TTL_DEFAULT
}

function getCached(key: string, interval: string, limit: number): CacheEntry | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < getCacheTtl(interval, limit)) return entry
  cache.delete(key)
  return null
}

function setCache(key: string, data: Ohlcv[], source: string) {
  cache.set(key, { data, timestamp: Date.now(), source })
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

async function getKvCache(key: string): Promise<CacheEntry | null> {
  try {
    let kv: any = null
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = getCloudflareContext()
      kv = (ctx as any)?.env?.luxtradee_kv
    } catch {}
    if (!kv) return null
    const raw = await kv.get(`candles:${key}`, 'text')
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

async function setKvCache(key: string, data: Ohlcv[], source: string, ttlSeconds: number): Promise<void> {
  try {
    let kv: any = null
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = getCloudflareContext()
      kv = (ctx as any)?.env?.luxtradee_kv
    } catch {}
    if (!kv) return
    const entry: CacheEntry = { data, timestamp: Date.now(), source }
    await kv.put(`candles:${key}`, JSON.stringify(entry), { expirationTtl: ttlSeconds })
  } catch {
    // KV tidak tersedia — skip
  }
}

/* ============================================================
   MAIN HANDLER
   ============================================================ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSymbol = searchParams.get('symbol') || 'XAUUSD'
    const rawInterval = searchParams.get('interval') || searchParams.get('timeframe') || '1h'
    const limit = Math.min(parseInt(searchParams.get('limit') || searchParams.get('outputsize') || '300'), 500)
    const nocache = searchParams.get('nocache') === 'true'

    const symbol = normalizeSymbol(rawSymbol)
    const interval = INTERVALS[rawInterval] ? rawInterval : '1h'

    if (!FOREX_SYMBOLS[symbol]) {
      console.warn(`[Candles] Simbol tidak didukung: "${rawSymbol}" → "${symbol}"`)
      return NextResponse.json({
        success: false,
        symbol,
        interval,
        data: [],
        source: 'unsupported',
        unavailable: true,
        message: `Simbol "${rawSymbol}" tidak didukung di /api/candles. Tersedia: ${Object.keys(FOREX_SYMBOLS).join(', ')}.`,
        fetchedAt: new Date().toISOString(),
      }, { status: 400 })
    }
    const validSymbol = symbol
    const cacheKey = `${validSymbol}:${interval}:${limit}`
    const kvTtlSeconds = limit <= 1 ? 30 : (interval === '5m' || interval === '15m') ? 60 : 300

    /* ---- Cache in-memory ---- */
    if (!nocache) {
      const cached = getCached(cacheKey, interval, limit)
      if (cached) {
        const age = Date.now() - cached.timestamp
        if (!(limit <= 1 && age > 15000)) {
          return NextResponse.json({
            success: true, symbol: validSymbol, interval,
            data: cached.data, source: cached.source + '-memcache',
            fetchedAt: new Date(cached.timestamp).toISOString(), stale: false,
          })
        }
        cache.delete(cacheKey) // price check butuh segar
      }
      /* ---- Cache KV (cross-isolate CF Workers) ---- */
      const kvCached = await getKvCache(cacheKey)
      if (kvCached && Date.now() - kvCached.timestamp < getCacheTtl(interval, limit)) {
        const kvAge = Date.now() - kvCached.timestamp
        if (!(limit <= 1 && kvAge > 15000)) {
          setCache(cacheKey, kvCached.data, kvCached.source)
          return NextResponse.json({
            success: true, symbol: validSymbol, interval,
            data: kvCached.data, source: kvCached.source + '-kvcache',
            fetchedAt: new Date(kvCached.timestamp).toISOString(), stale: false,
          })
        }
      }
    }

    /* ---- SUMBER 0: TRADING VIEW (keyless, grade broker) ---- */
    const tv = await fetchTradingViewCandles(validSymbol, interval, limit)
    if (tv && tv.length) {
      setCache(cacheKey, tv, 'tradingview')
      await setKvCache(cacheKey, tv, 'tradingview', kvTtlSeconds)
      console.log(`[Candles] ✓ ${tv.length} candles TradingView (${validSymbol} ${interval})`)
      return NextResponse.json({
        success: true, symbol: validSymbol, interval, data: tv,
        source: 'tradingview',
        fetchedAt: new Date().toISOString(),
      })
    }

    /* ---- SUMBER 1: FINNHUB (API resmi, butuh key) ---- */
    const fh = await fetchFinnhubCandles(validSymbol, interval, limit)
    if (fh && fh.length) {
      setCache(cacheKey, fh, 'finnhub')
      await setKvCache(cacheKey, fh, 'finnhub', kvTtlSeconds)
      console.log(`[Candles] ✓ ${fh.length} candles Finnhub (${validSymbol} ${interval})`)
      return NextResponse.json({
        success: true, symbol: validSymbol, interval, data: fh,
        source: 'finnhub',
        fetchedAt: new Date().toISOString(),
      })
    }

    /* ---- SUMBER 2: TWELVE DATA (spot-grade, mendekati feed broker) ----
       Tanpa key / quota habis → null → lanjut Yahoo. limit<=1 tetap
       aman: cache price 30s + rate limiter 7 req/menit di lib. */
    const td = await fetchTwelveDataCandles(validSymbol, interval, limit)
    if (td && td.length) {
      setCache(cacheKey, td, 'twelvedata')
      await setKvCache(cacheKey, td, 'twelvedata', kvTtlSeconds)
      console.log(`[Candles] ✓ ${td.length} candles Twelve Data (${validSymbol} ${interval})`)
      return NextResponse.json({
        success: true, symbol: validSymbol, interval, data: td,
        source: 'twelvedata',
        fetchedAt: new Date().toISOString(),
      })
    }

    /* ---- SUMBER 3: YAHOO FINANCE (publik, keyless → tanpa risiko 401) ----
       limit<=1 → liveTick aktif (regularMarketPrice sbg harga real-time) */
    const yf: YahooCandle[] | null = await fetchYahooChart(validSymbol, interval, limit, limit <= 1)
    if (yf && yf.length) {
      setCache(cacheKey, yf, 'yahoo-finance')
      await setKvCache(cacheKey, yf, 'yahoo-finance', kvTtlSeconds)
      console.log(`[Candles] ✓ ${yf.length} candles Yahoo Finance (${validSymbol} ${interval})`)
      return NextResponse.json({
        success: true, symbol: validSymbol, interval, data: yf,
        source: 'yahoo-finance',
        fetchedAt: new Date().toISOString(),
      })
    }

    /* ---- SEMUA SUMBER GAGAL — respons jujur (TANPA mock) ---- */
    console.error(`[Candles] ❌ Yahoo Finance gagal utk ${validSymbol} ${interval}`)
    return NextResponse.json({
      success: false,
      symbol: validSymbol,
      interval,
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: `Data live untuk ${validSymbol} sedang tidak dapat diakses. Coba beberapa menit lagi.`,
      fetchedAt: new Date().toISOString(),
    }, { status: 503 })
  } catch (error) {
    console.error('[Candles] ❌ Unhandled error:', error)
    return NextResponse.json({
      success: false,
      symbol: new URL(request.url).searchParams.get('symbol') || 'XAUUSD',
      interval: new URL(request.url).searchParams.get('interval') || '1h',
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: 'Data live sedang tidak dapat diakses. Terjadi kesalahan internal.',
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString(),
    }, { status: 503 })
  }
}
