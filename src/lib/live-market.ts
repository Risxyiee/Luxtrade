/**
 * Live Market Data Fetcher
 * Fetches REAL-TIME prices from free APIs — NO dummy/mock/hardcoded data.
 *
 * Sources (SEMUA KEYLESS, SE-SKALA CHART):
 * 1. gold-api / binance (via fetchChartScalePrice) — XAU/XAG/crypto
 *    (persis sumber tail chart /api/candles)
 * 2. TradingView (websocket publik, keyless) — semua simbol
 * 3. TwelveData (butuh TWELVE_DATA_API_KEY) — cadangan spot
 * 4. CoinGecko (keyless) — crypto saja
 *
 * YAHOO FINANCE DIHAPUS TOTAL (Bos 2026-11-11: "data lain yahoo
 * finance hapus aja").
 *
 * Returns null if ALL sources fail — never returns fake data.
 */

import { fetchChartScalePrice } from '@/lib/market/spot-live'
import { fetchTradingViewCandles } from '@/lib/market/tradingview'
import { fetchTwelveDataCandles } from '@/lib/market/twelvedata'
import { normalizeSymbol } from '@/lib/market/symbols'

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

// ── Candle terakhir → harga + perubahan 24 jam ──────────────────────
/** Ambil 2 bar terakhir dari rantai TradingView → TwelveData; harga =
    close bar terakhir, change24h dihitung dari bar sebelumnya bila
    rentang waktunya ±24 jam. Se-skala chart /api/candles. */
async function fetchPriceFromCandles(symbol: string): Promise<PriceCache | null> {
  try {
    const tv = await fetchTradingViewCandles(symbol, '1h', 2).catch(() => null)
    let bars = tv && tv.length ? tv : null
    let source = 'TradingView'
    if (!bars) {
      const td = await fetchTwelveDataCandles(symbol, '1h', 2).catch(() => null)
      if (!td || !td.length) return null
      bars = td
      source = 'TwelveData'
    }
    const last = bars[bars.length - 1]
    const prev = bars[bars.length - 2]
    if (!last || !(last.close > 0)) return null
    /* change24h hanya dihitung bila bar sebelumnya memang ±24 jam lalu
       (1h × 24) — selain itu undefined (jangan mengarang angka). */
    let change24h: number | undefined
    if (prev && prev.close > 0 && last.time - prev.time >= 23 * 3600 && last.time - prev.time <= 25 * 3600) {
      change24h = ((last.close - prev.close) / prev.close) * 100
    }
    return { price: last.close, change24h, source, timestamp: Date.now() }
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
  const canonical = normalizeSymbol(symbol)
  const cacheKey = `price:${canonical}`

  // Check cache
  const cached = getPriceCache(cacheKey)
  if (cached) return cached

  // Determine if crypto
  const isCrypto = /^(BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|MATIC|LINK|LTC|UNI|ATOM|APT|ARB|OP|NEAR|SUI|SEI|PEPE|WIF|SHIB)/i.test(canonical)

  // Try sources in order (semua keyless, se-skala chart)
  // 1. gold-api / binance — XAU/XAG/crypto (persis sumber tail chart)
  const chartScale = await fetchChartScalePrice(canonical).catch(() => null)
  if (chartScale && Number.isFinite(chartScale.price) && chartScale.price > 0) {
    const out: PriceCache = { price: chartScale.price, source: chartScale.source, timestamp: Date.now() }
    priceCache.set(cacheKey, out)
    return out
  }

  // 2. Candle terakhir TradingView → TwelveData (semua simbol)
  const fromCandles = await fetchPriceFromCandles(canonical)
  if (fromCandles) { priceCache.set(cacheKey, fromCandles); return fromCandles }

  // 3. CoinGecko (crypto only, free)
  if (isCrypto) {
    const cg = await fetchCoinGeckoPrice(canonical)
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
