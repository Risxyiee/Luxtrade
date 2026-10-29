/**
 * ============================================================
 * GET /api/candles — datafeed chart Vela (forex, gold, US100, crypto)
 * ============================================================
 * RANTAI SUMBER FINAL (Bos, dikonfirmasi 3× — verbatim:
 * "binaance yang dibuang"):
 *
 *   0. TRADING VIEW (websocket publik, KEYLESS) — grade broker
 *      (OANDA:XAUUSD, BINANCE:BTCUSDT utk crypto). Sudah diverifikasi
 *      hidup dari infra kita. Gagal/timeout → lanjut ke bawah.
 *
 *   1. TWELVE DATA (process.env.TWELVE_DATA_API_KEY) — candle
 *      SPOT XAU/USD, XAG/USD, forex major & NDX. Level harga
 *      paling mendekati feed broker (OANDA/MT4/MT5). Free tier
 *      8 req/min → rate limiter + cache ketat di lib twelvedata.
 *      TANPA key / quota habis / plan tak mencakup → NULL dan
 *      lanjut ke sumber di bawah (UI tidak pernah 401).
 *
 *   2. YAHOO Finance chart API (publik, GRATIS, TANPA API KEY)
 *      — fallback host otomatis query1 → query2. Selalu hidup.
 *      Crypto (BTCUSDT → BTC-USD) juga dilayani Yahoo.
 *
 * BINANCE DIBUANG (keputusan Bos). Finnhub PARKIR (butuh key,
 * bukan pilihan Bos utk rantai ini) — lib finnhub.ts dipertahankan.
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
 * KEDALAMAN HISTORY (Task — permintaan Bos, "minimal 3.000–5.000
 * historical candles ke belakang, terutama 1h/15m — BUKAN cuma 500"):
 *   - Param limit/outputsize diterima sampai 5000 bar per request.
 *   - Sumber dalam rantai menarik penuh: TradingView ws series
 *     1×request ≤5000 bar; Twelve Data outputsize ≤5000 (+pagination
 *     previous_close bila minta lebih); Yahoo period1/period2 paging
 *     (15m/30m window 60 hari, 1h sampai 730 hari) → akumulasi
 *     3–6 bulan candle tergabung KRONOLOGIS (ascending lama→baru).
 *   - Chart Vela (LuxtradeeForexProvider) meminta depth 5000 utk
 *     5m–1h → backtest Pine & scroll kiri tembus berminggu-minggu.
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

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* KEDALAMAN MAKSIMUM HISTORY per request (Bos: 3.000–5.000 bar,
   bukan lagi 500). Melebihi ini → klien harus memecah request. */
const MAX_LIMIT = 5000

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

/* LIVE micro-cache — khusus polling tick 3 detik dari chart Vela
   (provider.subscribe). TTL 2.5 detik: N client polling tiap 3 detik
   digabung jadi ±1 fetch upstream per 2.5s per (symbol,interval) —
   sumber (TradingView WS/TwelveData/Yahoo) tidak banjir request. */
const liveCache = new Map<string, CacheEntry>()
const LIVE_TTL = 2500

function getLiveCached(key: string): CacheEntry | null {
  const entry = liveCache.get(key)
  if (entry && Date.now() - entry.timestamp < LIVE_TTL) return entry
  liveCache.delete(key)
  return null
}

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

/* VERSI CACHE KV — RESET (permintaan Bos: "reset cache siapa tau
   masih cache lama"). Naikkan versi ini setiap ingin membuang SEMUA
   entri lama sekaligus: kunci lama jadi yatim & kedaluwarsa sendiri
   (TTL ≤ 300s), tanpa flush manual Cloudflare. */
const KV_CACHE_VER = 'v2'

async function getKvCache(key: string): Promise<CacheEntry | null> {
  try {
    let kv: any = null
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = getCloudflareContext()
      kv = (ctx as any)?.env?.luxtradee_kv
    } catch {}
    if (!kv) return null
    const raw = await kv.get(`candles:${KV_CACHE_VER}:${key}`, 'text')
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
    await kv.put(`candles:${KV_CACHE_VER}:${key}`, JSON.stringify(entry), { expirationTtl: ttlSeconds })
  } catch {
    // KV tidak tersedia — skip
  }
}

/* ============================================================
   RANTAI SUMBER BERSAMA — TradingView → TwelveData → Yahoo
   Dipakai jalur normal & jalur live (polling tick).
   ============================================================ */
async function fetchChain(
  symbol: string,
  interval: string,
  limit: number,
): Promise<{ bars: Ohlcv[]; source: string } | null> {
  /* 0) TRADING VIEW (keyless, grade broker) */
  try {
    const tv = await fetchTradingViewCandles(symbol, interval, limit)
    if (tv && tv.length) return { bars: tv, source: 'tradingview' }
  } catch { /* lanjut */ }

  /* 1) TWELVE DATA (spot-grade, mendekati feed broker) */
  try {
    const td = await fetchTwelveDataCandles(symbol, interval, limit)
    if (td && td.length) return { bars: td, source: 'twelvedata' }
  } catch { /* lanjut */ }

  /* 2) YAHOO FINANCE (publik, keyless → tanpa risiko 401) */
  try {
    const yf: YahooCandle[] | null = await fetchYahooChart(symbol, interval, limit, limit <= 1)
    if (yf && yf.length) return { bars: yf, source: 'yahoo-finance' }
  } catch { /* lanjut */ }

  return null
}

/* ============================================================
   MAIN HANDLER
   ============================================================ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSymbol = searchParams.get('symbol') || 'XAUUSD'
    const rawInterval = searchParams.get('interval') || searchParams.get('timeframe') || '1h'
    /* KEDALAMAN: default 300 (kompatibel pemanggil lama), tapi klien
       boleh minta sampai 5000 bar — chart Vela meminta depth penuh. */
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || searchParams.get('outputsize') || '300') || 300, 1),
      MAX_LIMIT,
    )
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

    /* ---- JALUR LIVE (polling tick 3 detik, tail saja) ----
       nocache + limit kecil = poll candle terakhir dari provider Vela.
       Pakai micro-cache 2.5s agar banyak client berbagi satu fetch
       upstream; jawaban TANPA cache HTTP (no-store) supaya ujung
       candle bergerak mulus layaknya feed broker. */
    if (nocache && limit <= 3) {
      const liveKey = `${validSymbol}:${interval}`
      const hit = getLiveCached(liveKey)
      if (hit) {
        return NextResponse.json({
          success: true, symbol: validSymbol, interval,
          data: hit.data.slice(-limit), source: hit.source + '-live',
          fetchedAt: new Date(hit.timestamp).toISOString(), stale: false,
        }, { headers: { 'Cache-Control': 'no-store' } })
      }
      const tail = await fetchChain(validSymbol, interval, Math.max(limit, 3))
      if (tail && tail.bars.length) {
        liveCache.set(liveKey, { data: tail.bars, timestamp: Date.now(), source: tail.source })
        if (liveCache.size > 300) {
          const oldest = [...liveCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
          if (oldest) liveCache.delete(oldest[0])
        }
        /* segarkan juga cache utama (bar terbaru berguna utk reload) */
        if (tail.bars.length >= 30) setCache(`${validSymbol}:${interval}:300`, tail.bars, tail.source)
        return NextResponse.json({
          success: true, symbol: validSymbol, interval,
          data: tail.bars.slice(-limit), source: tail.source,
          fetchedAt: new Date().toISOString(),
        }, { headers: { 'Cache-Control': 'no-store' } })
      }
      /* semua sumber gagal → jatuh ke cache utama (stale pun lebih baik
         dari kosong untuk ujung candle; chart tetap jalan) */
      const staleHit = cache.get(`${validSymbol}:${interval}:300`) || cache.get(cacheKey)
      if (staleHit) {
        return NextResponse.json({
          success: true, symbol: validSymbol, interval,
          data: staleHit.data.slice(-limit), source: staleHit.source + '-stale',
          fetchedAt: new Date(staleHit.timestamp).toISOString(), stale: true,
        }, { headers: { 'Cache-Control': 'no-store' } })
      }
      return NextResponse.json({
        success: false, symbol: validSymbol, interval, data: [],
        source: 'unavailable', unavailable: true,
        message: `Data live ${validSymbol} sedang tidak dapat diakses.`,
        fetchedAt: new Date().toISOString(),
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }

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

    /* ---- RANTAI SUMBER: TradingView → TwelveData → Yahoo ----
       (urutan FINAL Bos — "binaance yang dibuang"; limit<=1 →
       Yahoo liveTick aktif sbg harga real-time) */
    const chain = await fetchChain(validSymbol, interval, limit)
    if (chain) {
      setCache(cacheKey, chain.bars, chain.source)
      await setKvCache(cacheKey, chain.bars, chain.source, kvTtlSeconds)
      console.log(`[Candles] ✓ ${chain.bars.length} candles ${chain.source} (${validSymbol} ${interval})`)
      return NextResponse.json({
        success: true, symbol: validSymbol, interval, data: chain.bars,
        source: chain.source,
        fetchedAt: new Date().toISOString(),
      })
    }

    /* ---- SEMUA SUMBER GAGAL — respons jujur (TANPA mock) ---- */
    console.error(`[Candles] ❌ semua sumber gagal utk ${validSymbol} ${interval}`)
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
