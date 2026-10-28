/**
 * ============================================================
 * yahoo.ts — fetcher candle Yahoo Finance (publik, keyless)
 * ============================================================
 * Satu implementasi dipakai bersama oleh:
 *   - /api/forex        (watchlist & polling harga — sumber utama)
 *   - /api/candles      (datafeed chart Vela — sumber tunggal)
 *   - server-candles.ts (Protected Pine compile-pine)
 *
 * Yahoo Finance chart API = GRATIS, TANPA API KEY → tidak ada
 * kunci yang bisa salah konfigurasi, tidak ada risiko 401.
 */

/* ---------- Tabel simbol kanonik Luxtradee + presisi desimal ---------- */
export const FOREX_SYMBOLS: Record<string, { from: string; to: string; decimals: number }> = {
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
  // Indeks — Nasdaq 100 via futures NQ=F (≈ CFD US100, hampir 24 jam)
  'US100': { from: 'US100', to: 'USD', decimals: 1 },
}

/* ---------- Alias simbol / normalisasi ---------- */
export const SYMBOL_ALIASES: Record<string, string> = {
  // Indeks AS — Nasdaq 100 (US100 / NAS100 / USTEC / NDX / NASDAQ)
  'US100': 'US100', 'NAS100': 'US100', 'USTEC': 'US100', 'NDX': 'US100',
  'NASDAQ': 'US100', 'US100/USD': 'US100', 'USTEC100': 'US100',
  // Gold
  'XAU': 'XAUUSD', 'GOLD': 'XAUUSD', 'XAU/USD': 'XAUUSD',
  // Silver
  'XAG': 'XAGUSD', 'SILVER': 'XAGUSD', 'XAG/USD': 'XAGUSD',
  // Forex shorthand (popular with traders)
  'EUR/USD': 'EURUSD', 'GBP/USD': 'GBPUSD', 'USD/JPY': 'USDJPY',
  'EUR/GBP': 'EURGBP', 'EUR/JPY': 'EURJPY', 'GBP/JPY': 'GBPJPY',
  'AUD/USD': 'AUDUSD', 'NZD/USD': 'NZDUSD', 'USD/CAD': 'USDCAD', 'USD/CHF': 'USDCHF',
}

export function normalizeSymbol(rawSymbol: string): string {
  const cleaned = rawSymbol.trim().toUpperCase()
  if (!cleaned) return 'EURUSD' // blank → default
  if (SYMBOL_ALIASES[cleaned]) return SYMBOL_ALIASES[cleaned]
  if (FOREX_SYMBOLS[cleaned]) return cleaned
  return cleaned // unknown symbol — caller must handle
}

/* ---------- Sanity check harga (tolak data basi/salah) ---------- */
export function validatePrice(symbol: string, price: number): number | null {
  const info = FOREX_SYMBOLS[symbol]
  if (!info) return price

  if (isNaN(price) || price <= 0) return null

  // Gold (XAU/USD) — 2026 emas ~4000. Di bawah 2000 = basi/salah.
  if (info.from === 'XAU' && price < 2000) return null
  // Silver — ~30+. Di bawah 10 = basi/salah.
  if (info.from === 'XAG' && price < 10) return null
  // Pasangan JPY: puluhan–ratusan
  if (info.to === 'JPY' && price < 50) return null
  // Indeks US100 — rentang luas: futures/NDX ~25rb, QQQ (ETF proxy) ~600
  if (info.from === 'US100') {
    if (price < 100 || price > 100000) return null
    return price
  }
  // Forex non-JPY: 0.1–100
  if (info.to !== 'JPY' && info.from !== 'XAU' && info.from !== 'XAG') {
    if (price < 0.1 || price > 100) return null
  }

  return price
}

/* ---------- Format candle generik ---------- */
export interface YahooCandle {
  time: number // epoch detik
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

/* Simbol Yahoo: forex "EURUSD=X", futures GC=F (gold), SI=F (silver), NQ=F (Nasdaq) */
const YAHOO_SYMBOLS: Record<string, string> = {
  'XAUUSD': 'GC=F',
  'XAGUSD': 'SI=F',
  'US100': 'NQ=F',
  'EURUSD': 'EURUSD=X',
  'GBPUSD': 'GBPUSD=X',
  'USDJPY': 'USDJPY=X',
  'EURGBP': 'EURGBP=X',
  'EURJPY': 'EURJPY=X',
  'GBPJPY': 'GBPJPY=X',
  'AUDUSD': 'AUDUSD=X',
  'NZDUSD': 'NZDUSD=X',
  'USDCAD': 'USDCAD=X',
  'USDCHF': 'USDCHF=X',
}

/* Interval → {iv Yahoo, range} — 2h/4h tidak ada di Yahoo → agregasi dari 1h */
const YAHOO_INTERVALS: Record<string, { iv: string; range: string; agg?: number }> = {
  '5m': { iv: '5m', range: '1mo' },
  '15m': { iv: '15m', range: '1mo' },
  '30m': { iv: '30m', range: '1mo' },
  '1h': { iv: '1h', range: '3mo' },
  '2h': { iv: '1h', range: '6mo', agg: 2 },
  '4h': { iv: '1h', range: '6mo', agg: 4 },
  '1d': { iv: '1d', range: '1y' },
  '1w': { iv: '1wk', range: '2y' },
}

/** Gabungkan n candle 1 jam jadi 1 candle n-jam (baris rapi terurut) */
function aggregate(candles: YahooCandle[], n: number): YahooCandle[] {
  const out: YahooCandle[] = []
  for (let i = 0; i < candles.length; i += n) {
    const group = candles.slice(i, i + n)
    if (!group.length) break
    out.push({
      time: group[0].time,
      open: group[0].open,
      high: Math.max(...group.map((g) => g.high)),
      low: Math.min(...group.map((g) => g.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((s, g) => s + (g.volume || 0), 0),
    })
  }
  return out
}

/**
 * Ambil candle OHLC dari Yahoo Finance (keyless).
 * Dua host publik dicoba berurutan (query1 → query2) — bila satu
 * edge menolak request datacenter (crumb/bot filter), host kedua
 * tetap menjawab; tanpa API key → tidak ada skenario 401 auth.
 * @param symbol  simbol kanonik (XAUUSD, EURUSD, US100, …)
 * @param interval format kanonik ('5m','1h','1d', …)
 * @param limit   jumlah candle maksimum
 * @param liveTick true → tambahkan regularMarketPrice sbg tick terbaru (untuk polling harga)
 */
export async function fetchYahooChart(
  symbol: string,
  interval: string,
  limit: number,
  liveTick = false,
): Promise<YahooCandle[] | null> {
  const info = FOREX_SYMBOLS[symbol]
  const ySym = YAHOO_SYMBOLS[symbol]
  if (!info || !ySym) return null

  const cfg = YAHOO_INTERVALS[interval] || YAHOO_INTERVALS['1h']
  const path =
    `/v8/finance/chart/${encodeURIComponent(ySym)}` +
    `?interval=${cfg.iv}&range=${cfg.range}&includePrePost=false`

  for (const host of ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']) {
    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`${host}${path}`, {
        headers: {
          // Realistic browser UA — hindari bot detection Yahoo
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(tid)

      if (!res.ok) {
        console.warn(`[Yahoo] HTTP ${res.status} untuk ${symbol} (${ySym}) via ${host}`)
        continue // → host berikutnya
      }

      const json = await res.json()
      const result = json?.chart?.result?.[0]
      if (!result) continue // body tidak berisi chart → host berikutnya

      const meta = result.meta || {}
      const currentPrice = meta.regularMarketPrice
      const lastTradeTime = meta.regularMarketTime

      const timestamps: number[] = result.timestamp || []
      const quote = result.indicators?.quote?.[0]
      if (!quote || !timestamps.length) continue

      const candles: YahooCandle[] = []
      for (let i = 0; i < timestamps.length; i++) {
        const open = quote.open?.[i]
        const high = quote.high?.[i]
        const low = quote.low?.[i]
        const close = quote.close?.[i]
        if (open == null || high == null || low == null || close == null) continue
        if (high < low || open <= 0) continue
        if (validatePrice(symbol, close) === null) continue
        candles.push({
          time: timestamps[i],
          open: parseFloat(open.toFixed(info.decimals)),
          high: parseFloat(high.toFixed(info.decimals)),
          low: parseFloat(low.toFixed(info.decimals)),
          close: parseFloat(close.toFixed(info.decimals)),
          volume: Number.isFinite(Number(quote.volume?.[i])) ? Number(quote.volume?.[i]) : undefined,
        })
      }

      if (candles.length === 0) continue

      // Agregasi 2h/4h dari candle 1h
      const aggregated = cfg.agg ? aggregate(candles, cfg.agg) : candles
      aggregated.sort((a, b) => a.time - b.time)

      // Live tick: regularMarketPrice lebih baru dari candle terakhir (polling harga)
      if (liveTick && currentPrice && lastTradeTime && currentPrice > 0 && aggregated.length) {
        const last = aggregated[aggregated.length - 1]
        if (lastTradeTime > last.time && validatePrice(symbol, currentPrice) !== null) {
          aggregated.push({
            time: lastTradeTime,
            open: last.close,
            high: Math.max(last.high, currentPrice),
            low: Math.min(last.low, currentPrice),
            close: parseFloat(currentPrice.toFixed(info.decimals)),
          })
        }
      }

      return aggregated.slice(-limit) // sukses — langsung keluar
    } catch (err: any) {
      console.warn(`[Yahoo] error ${symbol} via ${host}: ${err?.message || err}`)
      continue // → host berikutnya
    }
  }

  // Semua host gagal — null jujur (penelepon memutuskan fallback/503)
  return null
}
