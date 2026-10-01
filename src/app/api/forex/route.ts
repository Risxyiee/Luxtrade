import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Forex symbols mapping with decimal precision (NO hardcoded prices)
const FOREX_SYMBOLS: Record<string, { from: string; to: string; decimals: number }> = {
  'XAUUSD': { from: 'XAU', to: 'USD', decimals: 2 },
  'XAGUSD': { from: 'XAG', to: 'USD', decimals: 3 },
  'EURUSD': { from: 'EUR', to: 'USD', decimals: 5 },
  'GBPUSD': { from: 'GBP', to: 'USD', decimals: 5 },
  'USDJPY': { from: 'USD', to: 'JPY', decimals: 3 },
  'EURGBP': { from: 'EUR', to: 'GBP', decimals: 5 },
  'EURJPY': { from: 'EUR', to: 'JPY', decimals: 3 },
  'GBPJPY': { from: 'GBP', to: 'JPY', decimals: 3 },
  'AUDUSD': { from: 'AUD', to: 'USD', decimals: 5 },
  'NZDUSD': { from: 'NZD', to: 'USD', decimals: 5 },
  'USDCAD': { from: 'USD', to: 'CAD', decimals: 5 },
  'USDCHF': { from: 'USD', to: 'CHF', decimals: 5 },
}

// ── CF Workers env vars ──────────────────────────────────────────────
// In CF Workers, secrets are on (request).env, not process.env
// We set this at request time (see GET handler)
let _cfEnv: any = null

function getAlphaVantageKey(): string {
  return process.env.ALPHA_VANTAGE_API_KEY || _cfEnv?.ALPHA_VANTAGE_API_KEY || ''
}
function getTwelveDataKey(): string {
  return process.env.TWELVE_DATA_API_KEY || _cfEnv?.TWELVE_DATA_API_KEY || ''
}

// ── In-memory cache with per-interval TTL ────────────────────────────
interface CacheEntry { data: any[]; timestamp: number; source: string }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_DEFAULT = 5 * 60 * 1000   // 5 minutes (chart data)
const CACHE_TTL_SHORT = 1 * 60 * 1000     // 1 minute for M5/M15
const CACHE_TTL_PRICE = 30 * 1000         // 30 seconds for limit=1 (price checks)

function getCacheTtl(interval: string, limit: number): number {
  // Price polling (limit=1) needs the freshest data
  if (limit <= 1) return CACHE_TTL_PRICE
  // Short timeframes need shorter cache for fresh data
  if (interval === '5m' || interval === '15m') return CACHE_TTL_SHORT
  return CACHE_TTL_DEFAULT
}

function getCached(key: string, interval: string, limit: number): CacheEntry | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < getCacheTtl(interval, limit)) return entry
  cache.delete(key)
  return null
}

function setCache(key: string, data: any[], source: string) {
  cache.set(key, { data, timestamp: Date.now(), source })
  // Prune old entries
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

// ── KV cache helpers (cross-isolate cache on CF Workers) ─────────────
async function getForexKVCache(request: NextRequest, key: string): Promise<CacheEntry | null> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings')
    const env = getCloudflareEnv(request as unknown as Request)
    const kv = env?.luxtradee_kv
    if (!kv) return null
    const raw = await kv.get(`forex:${key}`, 'text')
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry
  } catch {
    return null
  }
}

async function setForexKVCache(request: NextRequest, key: string, data: any[], source: string, ttlSeconds: number): Promise<void> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings')
    const env = getCloudflareEnv(request as unknown as Request)
    const kv = env?.luxtradee_kv
    if (!kv) return
    const entry: CacheEntry = { data, timestamp: Date.now(), source }
    await kv.put(`forex:${key}`, JSON.stringify(entry), { expirationTtl: ttlSeconds })
  } catch {
    // KV not available, skip
  }
}

// ── Twelve Data API (FREE: 800 req/day, intraday!) ──────────────────
async function fetchTwelveData(symbol: string, interval: string, limit: number): Promise<any[] | null> {
  const TWELVE_DATA_KEY = getTwelveDataKey()
  if (!TWELVE_DATA_KEY || TWELVE_DATA_KEY.length < 10) return null

  const info = FOREX_SYMBOLS[symbol]
  if (!info) return null

  // Map interval to Twelve Data format
  const tdIntervalMap: Record<string, string> = {
    '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1h', '4h': '4h', '1d': '1day', '1w': '1week',
  }
  const tdInterval = tdIntervalMap[interval] || interval

  // For commodity pairs (XAU, XAG), TwelveData uses the symbol directly
  const tdSymbol = `${info.from}/${info.to}`

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${tdInterval}&outputsize=${limit}&apikey=${TWELVE_DATA_KEY}`

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(tid)

    if (!res.ok) return null

    const json = await res.json()
    if (json.status === 'error' || !json.values || json.values.length === 0) return null

    return json.values
      .map((v: any) => ({
        time: Math.floor(new Date(v.datetime).getTime() / 1000),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
      }))
      .filter((k: any) => {
        if (k.time <= 0 || k.high < k.low || k.open <= 0) return false
        // Sanity check for commodity pairs
        if (info.from === 'XAU' && k.close < 100) return false
        if (info.from === 'XAG' && k.close < 5) return false
        return true
      })
      .sort((a: any, b: any) => a.time - b.time)
  } catch {
    return null
  }
}

// ── Alpha Vantage API (FREE: 25 req/day, daily only) ────────────────
async function fetchAlphaVantage(symbol: string, limit: number): Promise<any[] | null> {
  const ALPHA_VANTAGE_KEY = getAlphaVantageKey()
  if (!ALPHA_VANTAGE_KEY || ALPHA_VANTAGE_KEY === 'demo' || ALPHA_VANTAGE_KEY.length < 10) return null

  const info = FOREX_SYMBOLS[symbol]
  if (!info) return null

  // For commodity pairs (XAU/XAG), Alpha Vantage uses the commodity function
  const isCommodity = info.from === 'XAU' || info.from === 'XAG'
  const avFunction = isCommodity ? 'TIME_SERIES_DAILY' : 'FX_DAILY'
  // For commodities, symbol format is different
  const avUrl = isCommodity
    ? `https://www.alphavantage.co/query?function=${avFunction}&symbol=${info.from}${info.to}&apikey=${ALPHA_VANTAGE_KEY}&outputsize=compact`
    : `https://www.alphavantage.co/query?function=${avFunction}&from_symbol=${info.from}&to_symbol=${info.to}&apikey=${ALPHA_VANTAGE_KEY}&outputsize=compact`

  const url = avUrl

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(tid)

    if (!res.ok) return null

    const text = await res.text()
    if (text.includes('Thank you for using Alpha Vantage')) return null

    const data = JSON.parse(text)
    if (data['Error Message']) return null

    // Commodity pairs use 'Time Series (Daily)', forex uses 'Time Series FX (Daily)'
    const timeSeriesKey = isCommodity ? 'Time Series (Daily)' : 'Time Series FX (Daily)'
    if (!data[timeSeriesKey]) return null

    const timeSeries = data[timeSeriesKey]
    return Object.entries(timeSeries)
      .slice(0, limit)
      .reverse()
      .map(([date, values]: [string, any]) => ({
        time: Math.floor(new Date(date).getTime() / 1000),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
      }))
      .filter((k: any) => {
        if (k.time <= 0 || k.high < k.low || k.open <= 0) return false
        // Sanity check: XAU/USD should be > 100, XAG/USD > 10
        if (isCommodity && info.from === 'XAU' && k.close < 100) return false
        if (isCommodity && info.from === 'XAG' && k.close < 5) return false
        return true
      })
      .sort((a: any, b: any) => a.time - b.time)
  } catch {
    return null
  }
}

// ── Yahoo Finance (FREE, no API key needed, reliable) ────────────────
async function fetchYahooFinance(symbol: string, interval: string, limit: number): Promise<any[] | null> {
  const info = FOREX_SYMBOLS[symbol]
  if (!info) return null

  // Yahoo Finance symbol format: EURUSD=X
  // Commodity pairs use futures symbols: GC=F (Gold), SI=F (Silver)
  const commodityYahooSymbols: Record<string, string> = {
    'XAUUSD': 'GC=F',   // Gold Futures
    'XAGUSD': 'SI=F',   // Silver Futures
  }
  const yahooSymbol = commodityYahooSymbols[symbol] || `${info.from}${info.to}=X`

  // Map interval to Yahoo Finance format
  const yahooIntervalMap: Record<string, string> = {
    '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1wk',
  }
  const yahooInterval = yahooIntervalMap[interval] || '1h'
  // Yahoo range based on interval and limit
  const rangeMap: Record<string, string> = {
    '5m': '1d', '15m': '5d', '30m': '5d', '1h': '10d', '4h': '30d', '1d': '6mo', '1w': '1y',
  }
  const range = rangeMap[interval] || '5d'

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${yahooInterval}&range=${range}`

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      headers: {
        // Use a realistic browser User-Agent to avoid Yahoo bot detection
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(tid)

    if (!res.ok) return null

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    // Check Yahoo's meta for trading status — skip if market is closed and data is stale
    const meta = result.meta || {}
    const currentPrice = meta.regularMarketPrice
    const lastTradeTime = meta.regularMarketTime

    const timestamps = result.timestamp || []
    const quote = result.indicators?.quote?.[0]
    if (!quote || !timestamps.length) return null

    const candles: any[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i]
      const high = quote.high?.[i]
      const low = quote.low?.[i]
      const close = quote.close?.[i]
      // Skip candles with null values
      if (open == null || high == null || low == null || close == null) continue
      if (high < low || open <= 0) continue
      // Sanity check: XAU/USD should be > 100, XAG/USD > 5
      const isCommodity = info.from === 'XAU' || info.from === 'XAG'
      if (isCommodity && info.from === 'XAU' && close < 100) continue
      if (isCommodity && info.from === 'XAG' && close < 5) continue
      candles.push({
        time: timestamps[i],
        open: parseFloat(open.toFixed(info.decimals)),
        high: parseFloat(high.toFixed(info.decimals)),
        low: parseFloat(low.toFixed(info.decimals)),
        close: parseFloat(close.toFixed(info.decimals)),
      })
    }

    if (candles.length === 0) return null

    // For limit=1 (price check), also add the latest regularMarketPrice from meta
    // if it's more recent than the last candle. This gives us the real-time price
    // even between candle intervals.
    if (limit === 1 && currentPrice && lastTradeTime && currentPrice > 0) {
      const lastCandle = candles[candles.length - 1]
      if (lastTradeTime > lastCandle.time) {
        candles.push({
          time: lastTradeTime,
          open: lastCandle.close, // Use last close as open for the live tick
          high: Math.max(lastCandle.high, currentPrice),
          low: Math.min(lastCandle.low, currentPrice),
          close: parseFloat(currentPrice.toFixed(info.decimals)),
        })
      }
    }

    // Return only the requested limit
    return candles.slice(-limit).sort((a, b) => a.time - b.time)
  } catch (err: any) {
    console.warn(`[Forex] Yahoo Finance error for ${symbol}: ${err.message}`)
    return null
  }
}

// ── Main handler ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Expose CF Workers env vars (secrets) to API key helpers
  _cfEnv = (request as any).env || null

  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'EURUSD'
    const interval = searchParams.get('interval') || '1h'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)
    const nocache = searchParams.get('nocache') === 'true'
    const isPriceCheck = limit <= 1

    const validSymbol = FOREX_SYMBOLS[symbol] ? symbol : 'EURUSD'
    const cacheKey = `${validSymbol}:${interval}:${limit}`

    // Determine cache TTL for KV
    const kvTtlSeconds = isPriceCheck ? 30 : (interval === '5m' || interval === '15m') ? 60 : 300

    // Check in-memory cache first (unless nocache is set)
    if (!nocache) {
      const cached = getCached(cacheKey, interval, limit)
      if (cached) {
        return NextResponse.json({
          success: true,
          symbol: validSymbol,
          interval,
          data: cached.data,
          source: cached.source + '-memcache',
          fetchedAt: new Date(cached.timestamp).toISOString(),
          stale: isPriceCheck && (Date.now() - cached.timestamp > 15000), // Mark as stale if > 15s for price checks
        })
      }

      // Check KV cache (cross-isolate on CF Workers)
      const kvCached = await getForexKVCache(request, cacheKey)
      if (kvCached && Date.now() - kvCached.timestamp < getCacheTtl(interval, limit)) {
        // Populate in-memory cache from KV
        setCache(cacheKey, kvCached.data, kvCached.source)
        return NextResponse.json({
          success: true,
          symbol: validSymbol,
          interval,
          data: kvCached.data,
          source: kvCached.source + '-kvcache',
          fetchedAt: new Date(kvCached.timestamp).toISOString(),
          stale: isPriceCheck && (Date.now() - kvCached.timestamp > 15000),
        })
      }
    }

    const errors: string[] = []

    // Try Twelve Data first (best: intraday + free)
    const tdKey = getTwelveDataKey()
    console.log(`[Forex] Symbol=${validSymbol} Interval=${interval} Limit=${limit} Nocache=${nocache} TwelveData=${tdKey ? 'key:' + tdKey.substring(0, 6) + '...' : 'NOT SET'}`)
    const tdData = await fetchTwelveData(validSymbol, interval, limit)
    if (tdData && tdData.length > 0) {
      setCache(cacheKey, tdData, 'twelvedata')
      await setForexKVCache(request, cacheKey, tdData, 'twelvedata', kvTtlSeconds)
      console.log(`[Forex] ✓ ${tdData.length} candles from TwelveData`)
      return NextResponse.json({
        success: true,
        symbol: validSymbol,
        interval,
        data: tdData,
        source: 'twelvedata',
        fetchedAt: new Date().toISOString(),
      })
    }
    if (!tdKey || tdKey.length < 10) {
      errors.push('TwelveData: API key not configured')
    } else {
      errors.push('TwelveData: no data returned')
    }

    // Try Alpha Vantage (daily only)
    const avKey = getAlphaVantageKey()
    if (avKey) console.log(`[Forex] TwelveData failed, trying AlphaVantage (key: ${avKey.substring(0, 6)}...)`)
    const avData = await fetchAlphaVantage(validSymbol, limit)
    if (avData && avData.length > 0) {
      setCache(cacheKey, avData, 'alphavantage')
      await setForexKVCache(request, cacheKey, avData, 'alphavantage', kvTtlSeconds)
      console.log(`[Forex] ✓ ${avData.length} candles from AlphaVantage`)
      return NextResponse.json({
        success: true,
        symbol: validSymbol,
        interval,
        data: avData,
        source: 'alphavantage',
        note: 'Intraday not available — showing daily data',
        fetchedAt: new Date().toISOString(),
      })
    }
    if (avKey && avKey.length >= 10) {
      errors.push('AlphaVantage: no data returned')
    } else {
      errors.push('AlphaVantage: API key not configured')
    }

    // Try Yahoo Finance (free, no key needed)
    console.log(`[Forex] AlphaVantage failed, trying Yahoo Finance...`)
    const yfData = await fetchYahooFinance(validSymbol, interval, limit)
    if (yfData && yfData.length > 0) {
      setCache(cacheKey, yfData, 'yahoo-finance')
      await setForexKVCache(request, cacheKey, yfData, 'yahoo-finance', kvTtlSeconds)
      console.log(`[Forex] ✓ ${yfData.length} candles from Yahoo Finance`)
      return NextResponse.json({
        success: true,
        symbol: validSymbol,
        interval,
        data: yfData,
        source: 'yahoo-finance',
        fetchedAt: new Date().toISOString(),
      })
    }
    errors.push('Yahoo Finance: no data returned')

    // ALL LIVE SOURCES FAILED — return honest "unavailable" response (NO mock data)
    console.error(`[Forex] ❌ All live API sources failed for ${validSymbol}: ${errors.join('; ')}`)
    return NextResponse.json({
      success: false,
      symbol: validSymbol,
      interval,
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: `Data live untuk ${validSymbol} sedang tidak dapat diakses. Semua sumber API gagal: ${errors.join(', ')}. Coba beberapa menit lagi.`,
      errors,
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
