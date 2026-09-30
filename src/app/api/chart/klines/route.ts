import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── In-memory cache (5 min TTL) ──────────────────────────────────────
interface CacheEntry { data: any[]; timestamp: number; source: string }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached(key: string): CacheEntry | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry
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

// ── Binance API (FREE, no key needed, crypto only) ──────────────────
async function fetchBinanceKlines(symbol: string, interval: string, limit: number): Promise<any[] | null> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(tid)

    if (!response.ok) return null

    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) return null

    const ohlcData = data
      .map((kline: any[]) => ({
        time: Math.floor(kline[0] / 1000),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
      }))
      .filter((k: any) =>
        typeof k.time === 'number' && k.time > 0 &&
        typeof k.open === 'number' && typeof k.high === 'number' &&
        typeof k.low === 'number' && typeof k.close === 'number' &&
        k.high >= k.low && k.open > 0
      )
      .sort((a: any, b: any) => a.time - b.time)

    return ohlcData.length > 0 ? ohlcData : null
  } catch {
    return null
  }
}

// ── CoinGecko OHLC API (FREE, no key needed, crypto) ────────────────
// CoinGecko symbol mapping for common pairs
const COINGECKO_MAP: Record<string, string> = {
  'BTCUSDT': 'bitcoin',
  'ETHUSDT': 'ethereum',
  'BNBUSDT': 'binancecoin',
  'SOLUSDT': 'solana',
  'XRPUSDT': 'ripple',
  'DOGEUSDT': 'dogecoin',
  'ADAUSDT': 'cardano',
  'DOTUSDT': 'polkadot',
  'AVAXUSDT': 'avalanche-2',
  'MATICUSDT': 'matic-network',
  'LINKUSDT': 'chainlink',
  'LTCUSDT': 'litecoin',
}

async function fetchCoinGeckoKlines(symbol: string, interval: string, limit: number): Promise<any[] | null> {
  const coinId = COINGECKO_MAP[symbol.toUpperCase()]
  if (!coinId) return null

  // CoinGecko OHLC endpoint: /coins/{id}/ohlc
  // days: 1 (min 2min candles), 7, 14, 30, 90, 180, 365, max
  const daysMap: Record<string, string> = {
    '1m': '1', '5m': '1', '15m': '1', '30m': '1',
    '1h': '1', '4h': '7', '1d': '30',
  }
  const days = daysMap[interval] || '7'

  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)' },
      signal: controller.signal,
    })
    clearTimeout(tid)

    if (!res.ok) return null

    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null

    // CoinGecko OHLC format: [timestamp, open, high, low, close]
    const ohlcData = data
      .map((kline: number[]) => ({
        time: Math.floor(kline[0] / 1000),
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
      }))
      .filter((k: any) =>
        k.time > 0 && k.open > 0 && k.high >= k.low
      )
      .sort((a: any, b: any) => a.time - b.time)

    // Return only the requested limit
    return ohlcData.length > 0 ? ohlcData.slice(-limit) : null
  } catch {
    return null
  }
}

// ── CoinCap API (FREE, no key needed, crypto candles) ───────────────
const COINCAP_MAP: Record<string, string> = {
  'BTCUSDT': 'bitcoin',
  'ETHUSDT': 'ethereum',
  'BNBUSDT': 'binance-coin',
  'SOLUSDT': 'solana',
  'XRPUSDT': 'xrp',
  'DOGEUSDT': 'dogecoin',
  'ADAUSDT': 'cardano',
  'DOTUSDT': 'polkadot',
  'AVAXUSDT': 'avalanche',
  'LINKUSDT': 'chainlink',
  'LTCUSDT': 'litecoin',
}

async function fetchCoinCapHistory(symbol: string): Promise<any[] | null> {
  const coinId = COINCAP_MAP[symbol.toUpperCase()]
  if (!coinId) return null

  // CoinCap candles endpoint (1d history)
  const now = Date.now()
  const start = now - 24 * 60 * 60 * 1000 // last 24h
  const url = `https://api.coincap.io/v2/assets/${coinId}/history?interval=h1&start=${start}&end=${now}`

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(tid)

    if (!res.ok) return null

    const json = await res.json()
    const data = json?.data
    if (!Array.isArray(data) || data.length === 0) return null

    // CoinCap returns { time, priceUsd, circulatingSupply, ... }
    // Build simple OHLC from price points (use price as both open/high/low/close since we only have close)
    const candles: any[] = []
    for (let i = 0; i < data.length; i++) {
      const price = parseFloat(data[i].priceUsd)
      const time = Math.floor(data[i].time / 1000)
      if (price <= 0 || time <= 0) continue
      candles.push({
        time,
        open: price,
        high: price,
        low: price,
        close: price,
      })
    }

    return candles.length > 0 ? candles.sort((a, b) => a.time - b.time) : null
  } catch {
    return null
  }
}

// ── Main handler ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'BTCUSDT'
    const interval = searchParams.get('interval') || '15m'
    const limit = parseInt(searchParams.get('limit') || '50')

    const cacheKey = `${symbol}:${interval}:${limit}`

    // Check cache first
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: cached.data,
        source: cached.source + '-cache',
        fetchedAt: new Date(cached.timestamp).toISOString(),
      })
    }

    const errors: string[] = []

    // PRIMARY: Binance API (best for crypto — free, fast, OHLC)
    console.log(`[Klines] Symbol=${symbol} Interval=${interval} — trying Binance...`)
    const binanceData = await fetchBinanceKlines(symbol, interval, limit)
    if (binanceData && binanceData.length > 0) {
      setCache(cacheKey, binanceData, 'binance')
      console.log(`[Klines] ✓ ${binanceData.length} candles from Binance`)
      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: binanceData,
        source: 'binance',
        fetchedAt: new Date().toISOString(),
      })
    }
    errors.push('Binance: no data returned')

    // FALLBACK 1: CoinGecko OHLC (free, no key)
    console.log(`[Klines] Binance failed, trying CoinGecko...`)
    const cgData = await fetchCoinGeckoKlines(symbol, interval, limit)
    if (cgData && cgData.length > 0) {
      setCache(cacheKey, cgData, 'coingecko')
      console.log(`[Klines] ✓ ${cgData.length} candles from CoinGecko`)
      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: cgData,
        source: 'coingecko',
        fetchedAt: new Date().toISOString(),
      })
    }
    errors.push('CoinGecko: no data or unsupported symbol')

    // FALLBACK 2: CoinCap history (free, no key)
    console.log(`[Klines] CoinGecko failed, trying CoinCap...`)
    const ccData = await fetchCoinCapHistory(symbol)
    if (ccData && ccData.length > 0) {
      setCache(cacheKey, ccData, 'coincap')
      console.log(`[Klines] ✓ ${ccData.length} candles from CoinCap`)
      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: ccData,
        source: 'coincap',
        note: 'Only close prices available (no OHLC from CoinCap)',
        fetchedAt: new Date().toISOString(),
      })
    }
    errors.push('CoinCap: no data or unsupported symbol')

    // ALL LIVE SOURCES FAILED — return honest "unavailable" response (NO mock data)
    console.error(`[Klines] ❌ All live API sources failed for ${symbol}: ${errors.join('; ')}`)
    return NextResponse.json({
      success: false,
      symbol,
      interval,
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: `Data live untuk ${symbol} sedang tidak dapat diakses. Semua sumber API gagal: ${errors.join(', ')}. Coba beberapa menit lagi.`,
      errors,
      fetchedAt: new Date().toISOString(),
    }, { status: 503 })
  } catch (error) {
    console.error(`[Klines] ❌ Unhandled error:`, error)
    return NextResponse.json({
      success: false,
      symbol: new URL(request.url).searchParams.get('symbol') || 'BTCUSDT',
      interval: new URL(request.url).searchParams.get('interval') || '15m',
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: 'Data live sedang tidak dapat diakses. Terjadi kesalahan internal. Coba beberapa menit lagi.',
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString(),
    }, { status: 503 })
  }
}
