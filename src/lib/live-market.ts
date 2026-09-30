/**
 * Live Market Data Fetcher
 * Fetches REAL-TIME prices from free APIs — NO dummy/mock/hardcoded data.
 *
 * Sources:
 * 1. TwelveData (API key required) — forex, stocks, crypto
 * 2. Yahoo Finance (free, no key) — forex, stocks, crypto
 * 3. Binance (free, no key) — crypto only
 * 4. CoinGecko (free, no key) — crypto only
 *
 * Returns null if ALL sources fail — never returns fake data.
 */

// ── Cache ──────────────────────────────────────────────────────────
interface PriceCache { price: number; change24h?: number; source: string; timestamp: number }
const priceCache = new Map<string, PriceCache>()
const PRICE_CACHE_TTL = 2 * 60 * 1000 // 2 minutes for real-time feel

function getPriceCache(key: string): PriceCache | null {
  const entry = priceCache.get(key)
  if (entry && Date.now() - entry.timestamp < PRICE_CACHE_TTL) return entry
  priceCache.delete(key)
  return null
}

// ── TwelveData Real-time Price ─────────────────────────────────────
async function fetchTwelveDataPrice(symbol: string): Promise<PriceCache | null> {
  const key = process.env.TWELVE_DATA_API_KEY
  if (!key || key.length < 10) return null

  // Map common symbols to TwelveData format
  const symbolMap: Record<string, string> = {
    'XAUUSD': 'XAU/USD', 'XAGUSD': 'XAG/USD',
    'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY',
    'AUDUSD': 'AUD/USD', 'NZDUSD': 'NZD/USD', 'USDCAD': 'USD/CAD', 'USDCHF': 'USD/CHF',
    'EURGBP': 'EUR/GBP', 'EURJPY': 'EUR/JPY', 'GBPJPY': 'GBP/JPY',
  }
  const tdSymbol = symbolMap[symbol.toUpperCase()] || symbol

  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(tdSymbol)}&apikey=${key}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    const price = parseFloat(json.price)
    if (isNaN(price) || price <= 0) return null

    return { price, source: 'TwelveData', timestamp: Date.now() }
  } catch {
    return null
  }
}

// ── Yahoo Finance Real-time Price ──────────────────────────────────
async function fetchYahooPrice(symbol: string): Promise<PriceCache | null> {
  // Map symbols to Yahoo Finance format
  const isCrypto = /^(BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|MATIC|LINK|LTC|UNI|ATOM|FIL|APT|ARB|OP|NEAR|SUI|SEI|PEPE|WIF|SHIB)/i.test(symbol)
  const isForex = /^(XAU|XAG|EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY){3,6}$/i.test(symbol.replace('/', ''))

  let yahooSymbol: string
  if (symbol.includes('/')) {
    yahooSymbol = symbol.replace('/', '') + '=X'
  } else if (isCrypto && symbol.toUpperCase().endsWith('USD')) {
    // BTCUSD → BTC-USD
    yahooSymbol = symbol.slice(0, -3) + '-USD'
  } else if (isCrypto) {
    yahooSymbol = symbol + '-USD'
  } else if (symbol.length === 6 && !symbol.includes('/')) {
    // EURUSD → EURUSD=X
    yahooSymbol = symbol + '=X'
  } else {
    yahooSymbol = symbol
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return null

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const meta = result.meta
    const price = meta?.regularMarketPrice
    const prevPrice = meta?.chartPreviousClose || meta?.previousClose
    if (!price || price <= 0) return null

    const change24h = prevPrice ? ((price - prevPrice) / prevPrice) * 100 : undefined

    return { price, change24h, source: 'Yahoo Finance', timestamp: Date.now() }
  } catch {
    return null
  }
}

// ── Binance Price (crypto only) ────────────────────────────────────
async function fetchBinancePrice(symbol: string): Promise<PriceCache | null> {
  // Convert to Binance format: BTCUSD → BTCUSDT
  let binanceSymbol = symbol.toUpperCase().replace('/', '')
  if (!binanceSymbol.endsWith('USDT') && !binanceSymbol.endsWith('BUSD') && !binanceSymbol.endsWith('BTC') && !binanceSymbol.endsWith('ETH')) {
    // Assume USDT pair for crypto
    if (/^(BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|MATIC|LINK|LTC)/i.test(binanceSymbol)) {
      binanceSymbol = binanceSymbol.replace(/USD$/, 'USDT')
      if (!binanceSymbol.endsWith('USDT')) binanceSymbol += 'USDT'
    } else {
      return null // Not a crypto symbol Binance would know
    }
  }

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null

    const json = await res.json()
    const price = parseFloat(json.price)
    if (isNaN(price) || price <= 0) return null

    // Also get 24h change
    let change24h: number | undefined
    try {
      const res24h = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res24h.ok) {
        const data = await res24h.json()
        change24h = parseFloat(data.priceChangePercent)
      }
    } catch { /* ignore */ }

    return { price, change24h, source: 'Binance', timestamp: Date.now() }
  } catch {
    return null
  }
}

// ── CoinGecko Price (crypto only) ──────────────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin', 'SOL': 'solana',
  'XRP': 'ripple', 'DOGE': 'dogecoin', 'ADA': 'cardano', 'DOT': 'polkadot',
  'AVAX': 'avalanche-2', 'MATIC': 'matic-network', 'LINK': 'chainlink',
  'LTC': 'litecoin', 'UNI': 'uniswap', 'ATOM': 'cosmos', 'APT': 'apt',
  'ARB': 'arbitrum', 'OP': 'optimism', 'NEAR': 'near',
}

async function fetchCoinGeckoPrice(symbol: string): Promise<PriceCache | null> {
  const base = symbol.toUpperCase().replace(/USDT?$/, '').replace(/BUSD$/, '')
  const coinId = COINGECKO_IDS[base]
  if (!coinId) return null

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return null

    const json = await res.json()
    const data = json[coinId]
    if (!data?.usd || data.usd <= 0) return null

    return { price: data.usd, change24h: data.usd_24h_change, source: 'CoinGecko', timestamp: Date.now() }
  } catch {
    return null
  }
}

// ── Unified fetcher ────────────────────────────────────────────────
/**
 * Fetch real-time price for a symbol.
 * Tries multiple sources in order. Returns null if all fail (NEVER fake data).
 */
export async function fetchLivePrice(symbol: string): Promise<PriceCache | null> {
  const normalizedSymbol = symbol.toUpperCase().replace('/', '')
  const cacheKey = `price:${normalizedSymbol}`

  // Check cache
  const cached = getPriceCache(cacheKey)
  if (cached) return cached

  // Determine if crypto
  const isCrypto = /^(BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|MATIC|LINK|LTC|UNI|ATOM|APT|ARB|OP|NEAR|SUI|SEI|PEPE|WIF|SHIB)/i.test(normalizedSymbol)

  // Try sources in order
  // 1. TwelveData (if key available)
  const td = await fetchTwelveDataPrice(normalizedSymbol)
  if (td) { priceCache.set(cacheKey, td); return td }

  // 2. Yahoo Finance (free, no key)
  const yf = await fetchYahooPrice(normalizedSymbol)
  if (yf) { priceCache.set(cacheKey, yf); return yf }

  // 3. Binance (crypto only, free)
  if (isCrypto) {
    const bn = await fetchBinancePrice(normalizedSymbol)
    if (bn) { priceCache.set(cacheKey, bn); return bn }
  }

  // 4. CoinGecko (crypto only, free)
  if (isCrypto) {
    const cg = await fetchCoinGeckoPrice(normalizedSymbol)
    if (cg) { priceCache.set(cacheKey, cg); return cg }
  }

  // All sources failed — return null (NO fake data)
  return null
}

/**
 * Fetch live context data for AI chat system prompt.
 * Returns a string with current market data that gets injected into the AI prompt.
 * Only includes data from live sources — never includes dummy/sample data.
 */
export async function fetchLiveMarketContext(symbols?: string[]): Promise<string> {
  const defaultSymbols = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'ETHUSDT']
  const targetSymbols = symbols || defaultSymbols

  const lines: string[] = []
  const now = new Date()
  lines.push(`⏰ Data diambil: ${now.toISOString()} (UTC)`)

  for (const symbol of targetSymbols) {
    try {
      const data = await fetchLivePrice(symbol)
      if (data) {
        const changeStr = data.change24h != null ? ` (${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}% 24h)` : ''
        lines.push(`- ${symbol}: ${data.price} ${changeStr} [sumber: ${data.source}]`)
      } else {
        lines.push(`- ${symbol}: ❌ Data live tidak tersedia saat ini`)
      }
    } catch {
      lines.push(`- ${symbol}: ❌ Error mengambil data`)
    }
  }

  return lines.join('\n')
}
