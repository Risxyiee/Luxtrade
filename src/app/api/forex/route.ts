/**
 * ============================================================
 * GET /api/forex — candle OHLC & harga forex / gold / US100
 * ============================================================
 * RANTAI SUMBER SE-SKALA CHART (sama dengan /api/candles — Bos:
 * "data chart make twelve aja"):
 *   1. TWELVE DATA (spot-grade: XAU/USD dkk) — candle
 *   2. TRADING VIEW (websocket publik keyless, spot-grade) — candle
 *   3. YAHOO — fallback terakhir (forex/indeks setara spot; logam
 *      = futures, hanya dipakai bila TD+TV mati)
 *   Price-check (limit<=1): gold-api/binance dulu — PERSIS sumber
 *   tail chart → watchlist & panel tidak pernah beda skala dgn chart.
 *
 * DIPAKAI OLEH: WatchlistTab (polling harga limit=1) & panel lain.
 * Datafeed CHART VELA lewat /api/candles.
 *
 * Fitur:
 *   - Alias simbol (GOLD→XAUUSD, NASDAQ→US100, "XAU/USD", dst.)
 *   - Sanity check harga (XAU < 2000 / US100 di luar rentang → reject)
 *   - Cache in-memory (TTL per-interval) + KV Cloudflare (cross-isolate)
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
  validatePrice,
  type YahooCandle,
} from '@/lib/market/yahoo'
/* RANTAI SE-SKALA CHART (fix Bos: "chart xau putus"): dulu endpoint ini
   Yahoo-ONLY — XAU/XAG = futures GC=F/SI=F: harga beda $8-15 dari chart
   Twelve Data spot + bolong 2 jam tiap hari (halt dagang futures) →
   chart terlihat "putus/melenceng". Sekarang satu skala dengan
   /api/candles: TradingView → TwelveData → Yahoo (Bos 2026-11-11:
   "data ambil dari TradingView"), dan price-check
   (limit<=1) memakai sumber yang SAMA dengan tail chart
   (gold-api utk XAU/XAG, binance utk crypto) via fetchChartScalePrice. */
import { fetchTwelveDataCandles } from '@/lib/market/twelvedata'
import { fetchTradingViewCandles } from '@/lib/market/tradingview'
import { fetchChartScalePrice } from '@/lib/market/spot-live'
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
// FASE 3: rate-limit — request nocache=true & cache-miss tetap memukul
// Yahoo; tanpa batas bisa dihitung untuk membanjiri upstream. 60 req/menit
// /IP longgar utk chart panel normal (umumnya dilayani SW cache).
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// ── Main handler ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const limited = checkRateLimit(request, 'forex', {
      maxRequests: 60,
      windowMs: 60_000,
      message: 'Terlalu banyak permintaan data pasar. Coba lagi beberapa detik lagi.',
    })
    if (limited) return limited

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

    // ── PRICE CHECK (limit<=1) — harga SE-SKALA CHART dulu ──
    // XAU/XAG → gold-api, crypto → binance (persis sumber tail chart);
    // Yahoo liveTick hanya fallback (forex/indeks setara spot TD).
    if (isPriceCheck) {
      const chartScale = await fetchChartScalePrice(validSymbol)
      if (chartScale && Number.isFinite(chartScale.price)) {
        const valid = validatePrice(validSymbol, chartScale.price)
        if (valid != null) {
          const candle: YahooCandle[] = [{ time: Math.floor(Date.now() / 1000), open: valid, high: valid, low: valid, close: valid }]
          setCache(cacheKey, candle, chartScale.source)
          await setForexKVCache(cacheKey, candle, chartScale.source, 30)
          console.log(`[Forex] ✓ harga ${validSymbol} = ${valid} dari ${chartScale.source} (se-skala chart)`)
          return NextResponse.json({
            success: true,
            symbol: validSymbol,
            interval,
            data: candle,
            source: chartScale.source,
            fetchedAt: new Date().toISOString(),
          })
        }
      }
    }

    // ── CANDLE — rantai se-skala chart: TradingView → TwelveData → Yahoo ──
    // (Bos 2026-11-11: "data ambil dari TradingView — semua dari situ")
    let bars: YahooCandle[] | null = null
    let sourceLabel = 'yahoo-finance'
    try {
      const tv = await fetchTradingViewCandles(validSymbol, interval, limit)
      if (tv && tv.length) { bars = tv; sourceLabel = 'tradingview' }
    } catch { /* lanjut sumber berikutnya */ }
    if (!bars) {
      try {
        const td = await fetchTwelveDataCandles(validSymbol, interval, limit)
        if (td && td.length) { bars = td; sourceLabel = 'twelvedata' }
      } catch { /* lanjut Yahoo */ }
    }
    if (!bars) {
      const yf = await fetchYahooChart(validSymbol, interval, limit, isPriceCheck)
      if (yf && yf.length) { bars = yf; sourceLabel = 'yahoo-finance' }
    }

    if (bars && bars.length > 0) {
      setCache(cacheKey, bars, sourceLabel)
      await setForexKVCache(cacheKey, bars, sourceLabel, kvTtlSeconds)
      console.log(`[Forex] ✓ ${bars.length} candles from ${sourceLabel} (${validSymbol} ${interval})`)
      return NextResponse.json({
        success: true,
        symbol: validSymbol,
        interval,
        data: bars,
        source: sourceLabel,
        fetchedAt: new Date().toISOString(),
      })
    }

    // SUMBER GAGAL — respons jujur (TANPA mock data)
    console.error(`[Forex] ❌ semua sumber (TD/TV/Yahoo) gagal utk ${validSymbol} ${interval}`)
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
