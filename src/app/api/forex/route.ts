import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Forex symbols mapping with realistic current prices
const FOREX_SYMBOLS: Record<string, { from: string; to: string; basePrice: number; decimals: number }> = {
  'XAUUSD': { from: 'XAU', to: 'USD', basePrice: 3260.00, decimals: 2 },
  'XAGUSD': { from: 'XAG', to: 'USD', basePrice: 32.80, decimals: 3 },
  'EURUSD': { from: 'EUR', to: 'USD', basePrice: 1.1150, decimals: 5 },
  'GBPUSD': { from: 'GBP', to: 'USD', basePrice: 1.2740, decimals: 5 },
  'USDJPY': { from: 'USD', to: 'JPY', basePrice: 149.80, decimals: 3 },
  'EURGBP': { from: 'EUR', to: 'GBP', basePrice: 0.8750, decimals: 5 },
  'EURJPY': { from: 'EUR', to: 'JPY', basePrice: 166.95, decimals: 3 },
  'GBPJPY': { from: 'GBP', to: 'JPY', basePrice: 190.85, decimals: 3 },
  'AUDUSD': { from: 'AUD', to: 'USD', basePrice: 0.6350, decimals: 5 },
  'NZDUSD': { from: 'NZD', to: 'USD', basePrice: 0.5880, decimals: 5 },
  'USDCAD': { from: 'USD', to: 'CAD', basePrice: 1.3750, decimals: 5 },
  'USDCHF': { from: 'USD', to: 'CHF', basePrice: 0.8820, decimals: 5 },
}

// API keys — lazy-read at request time (CF Workers env vars not available at module load)
function getAlphaVantageKey(): string {
  return process.env.ALPHA_VANTAGE_API_KEY || ''
}
function getTwelveDataKey(): string {
  return process.env.TWELVE_DATA_API_KEY || ''
}

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
  // Prune old entries
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

// ── Twelve Data API (FREE: 800 req/day, intraday!) ──────────────────
async function fetchTwelveData(symbol: string, interval: string, limit: number): Promise<any[] | null> {
  const TWELVE_DATA_KEY = getTwelveDataKey()
  if (!TWELVE_DATA_KEY || TWELVE_DATA_KEY.length < 10) return null

  const info = FOREX_SYMBOLS[symbol]
  if (!info) return null

  // Map interval to Twelve Data format
  const tdInterval = interval === '1d' ? '1day' : interval // 5m, 15m, 1h, 4h, 1day

  const url = `https://api.twelvedata.com/time_series?symbol=${info.from}/${info.to}&interval=${tdInterval}&outputsize=${limit}&apikey=${TWELVE_DATA_KEY}`

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
      .filter((k: any) => k.time > 0 && k.high >= k.low && k.open > 0)
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

  const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${info.from}&to_symbol=${info.to}&apikey=${ALPHA_VANTAGE_KEY}&outputsize=compact`

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(tid)

    if (!res.ok) return null

    const text = await res.text()
    if (text.includes('Thank you for using Alpha Vantage')) return null

    const data = JSON.parse(text)
    if (data['Error Message'] || !data['Time Series FX (Daily)']) return null

    const timeSeries = data['Time Series FX (Daily)']
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
      .filter((k: any) => k.time > 0 && k.high >= k.low && k.open > 0)
      .sort((a: any, b: any) => a.time - b.time)
  } catch {
    return null
  }
}

// ── Realistic mock data (when all APIs fail) ────────────────────────
function generateMockData(symbol: string, interval: string, count: number): any[] {
  const info = FOREX_SYMBOLS[symbol] || FOREX_SYMBOLS['EURUSD']
  const d = info.decimals

  // Interval to ms mapping
  const intervalMs: Record<string, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000,
    '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
  }
  const stepMs = intervalMs[interval] || intervalMs['15m']

  const data: any[] = []
  let timestamp = Date.now() - (count * stepMs)
  let price = info.basePrice

  // Volatility per interval (more realistic)
  const vol = interval === '1d' ? 0.003 : interval === '4h' ? 0.0015 : interval === '1h' ? 0.001 : 0.0005

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2 * vol * price
    const open = price
    const close = price + change
    const wickUp = Math.random() * Math.abs(change) * 0.5
    const wickDown = Math.random() * Math.abs(change) * 0.5
    const high = Math.max(open, close) + wickUp
    const low = Math.min(open, close) - wickDown

    data.push({
      time: Math.floor(timestamp / 1000),
      open: parseFloat(open.toFixed(d)),
      high: parseFloat(high.toFixed(d)),
      low: parseFloat(low.toFixed(d)),
      close: parseFloat(close.toFixed(d)),
    })

    price = close
    timestamp += stepMs
  }

  return data.sort((a, b) => a.time - b.time)
}

// ── Main handler ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'EURUSD'
    const interval = searchParams.get('interval') || '15m'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const validSymbol = FOREX_SYMBOLS[symbol] ? symbol : 'EURUSD'
    const cacheKey = `${validSymbol}:${interval}:${limit}`

    // Check cache first
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        symbol: validSymbol,
        interval,
        data: cached.data,
        source: cached.source + '-cache',
      })
    }

    // Try Twelve Data first (best: intraday + free)
    const tdKey = getTwelveDataKey()
    console.log(`[Forex] Symbol=${validSymbol} Interval=${interval} TwelveData=${tdKey ? 'key:' + tdKey.substring(0, 6) + '...' : 'NOT SET'}`)
    const tdData = await fetchTwelveData(validSymbol, interval, limit)
    if (tdData && tdData.length > 0) {
      setCache(cacheKey, tdData, 'twelvedata')
      console.log(`[Forex] ✓ ${tdData.length} candles from TwelveData`)
      return NextResponse.json({
        success: true,
        symbol: validSymbol,
        interval,
        data: tdData,
        source: 'twelvedata',
      })
    }

    // Try Alpha Vantage (daily only)
    const avKey = getAlphaVantageKey()
    if (avKey) console.log(`[Forex] TwelveData failed, trying AlphaVantage (key: ${avKey.substring(0, 6)}...)`)
    const avData = await fetchAlphaVantage(validSymbol, limit)
    if (avData && avData.length > 0) {
      setCache(cacheKey, avData, 'alphavantage')
      console.log(`[Forex] ✓ ${avData.length} candles from AlphaVantage`)
      return NextResponse.json({
        success: true,
        symbol: validSymbol,
        interval,
        data: avData,
        source: 'alphavantage',
        note: 'Intraday not available — showing daily data',
      })
    }

    // Fallback: realistic mock
    console.warn(`[Forex] ⚠️ All real APIs failed for ${validSymbol}, using mock data`)
    const mockData = generateMockData(validSymbol, interval, limit)
    setCache(cacheKey, mockData, 'mock')

    return NextResponse.json({
      success: true,
      symbol: validSymbol,
      interval,
      data: mockData,
      source: 'mock',
      note: 'Add TWELVE_DATA_API_KEY or ALPHA_VANTAGE_API_KEY for real market data',
    })
  } catch (error) {
    const symbol = new URL(request.url).searchParams.get('symbol') || 'EURUSD'
    const interval = new URL(request.url).searchParams.get('interval') || '15m'
    const mockData = generateMockData(symbol, interval, 20)

    return NextResponse.json({
      success: true,
      symbol,
      interval,
      data: mockData,
      source: 'mock-fallback',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
