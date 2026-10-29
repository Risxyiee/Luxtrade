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
  // Crypto (BINANCE DIBUANG — crypto kini via TradingView/Finnhub/Yahoo)
  'BTCUSDT': { from: 'BTC', to: 'USDT', decimals: 2 },
  'ETHUSDT': { from: 'ETH', to: 'USDT', decimals: 2 },
  'SOLUSDT': { from: 'SOL', to: 'USDT', decimals: 2 },
  'XRPUSDT': { from: 'XRP', to: 'USDT', decimals: 4 },
  'DOGEUSDT': { from: 'DOGE', to: 'USDT', decimals: 5 },
  'ADAUSDT': { from: 'ADA', to: 'USDT', decimals: 4 },
  'LTCUSDT': { from: 'LTC', to: 'USDT', decimals: 2 },
  'BNBUSDT': { from: 'BNB', to: 'USDT', decimals: 2 },
  'LINKUSDT': { from: 'LINK', to: 'USDT', decimals: 3 },
  'AVAXUSDT': { from: 'AVAX', to: 'USDT', decimals: 3 },
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
  // Crypto shorthand
  'BTC': 'BTCUSDT', 'BTC/USD': 'BTCUSDT', 'BTCUSD': 'BTCUSDT',
  'ETH': 'ETHUSDT', 'ETH/USD': 'ETHUSDT', 'ETHUSD': 'ETHUSDT',
  'SOL': 'SOLUSDT', 'SOL/USD': 'SOLUSDT', 'SOLUSD': 'SOLUSDT',
  'XRP': 'XRPUSDT', 'XRP/USD': 'XRPUSDT', 'XRPUSD': 'XRPUSDT',
  'DOGE': 'DOGEUSDT', 'DOGE/USD': 'DOGEUSDT', 'DOGEUSD': 'DOGEUSDT',
  'ADA': 'ADAUSDT', 'ADA/USD': 'ADAUSDT', 'ADAUSD': 'ADAUSDT',
  'LTC': 'LTCUSDT', 'LTC/USD': 'LTCUSDT', 'LTCUSD': 'LTCUSDT',
  'BNB': 'BNBUSDT', 'BNB/USD': 'BNBUSDT', 'BNBUSD': 'BNBUSDT',
  'LINK': 'LINKUSDT', 'LINK/USD': 'LINKUSDT', 'LINKUSD': 'LINKUSDT',
  'AVAX': 'AVAXUSDT', 'AVAX/USD': 'AVAXUSDT', 'AVAXUSD': 'AVAXUSDT',
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
  // Crypto: cukup pastikan positif (PEPE dkk sangat kecil)
  if (info.to === 'USDT') return price > 0 ? price : null
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

/* Simbol Yahoo: forex "EURUSD=X", futures GC=F (gold), SI=F (silver), NQ=F (Nasdaq), crypto BTC-USD */
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
  'BTCUSDT': 'BTC-USD',
  'ETHUSDT': 'ETH-USD',
  'SOLUSDT': 'SOL-USD',
  'XRPUSDT': 'XRP-USD',
  'DOGEUSDT': 'DOGE-USD',
  'ADAUSDT': 'ADA-USD',
  'LTCUSDT': 'LTC-USD',
  'BNBUSDT': 'BNB-USD',
  'LINKUSDT': 'LINK-USD',
  'AVAXUSDT': 'AVAX-USD',
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

/* ============================================================
   KEDALAMAN HISTORY per interval (permintaan Bos: 3.000–5.000 bar,
   BUKAN lagi 500) — batas keras Yahoo per interval:
   - 5m/15m/30m : data hanya tersedia 60 HARI terakhir → akumulasi
                  penuh window itu (≈ 4.000+ bar utk 24/5 market).
   - 1h         : tersedia sampai 730 HARI → paging 180 hari/halaman,
                  5000 bar tercapai ±6 bulan ke belakang.
   - 1d/1wk     : sejarah penuh (paging jauh tidak perlu).
   chunkDays = lebar satu halaman period1/period2 — cukup kecil agar
   Yahoo tidak memotong respons, cukup besar agar paging efisien. */
const YAHOO_DEPTH: Record<string, { maxDays: number; chunkDays: number }> = {
  '5m': { maxDays: 60, chunkDays: 30 },
  '15m': { maxDays: 60, chunkDays: 60 },
  '30m': { maxDays: 60, chunkDays: 60 },
  '1h': { maxDays: 730, chunkDays: 180 },
  '2h': { maxDays: 730, chunkDays: 180 },
  '4h': { maxDays: 730, chunkDays: 180 },
  '1d': { maxDays: 730, chunkDays: 730 },
  '1w': { maxDays: 1825, chunkDays: 1825 },
}

/** Satu halaman chart Yahoo (range ATAU period1/period2) → rows + meta.
    Meta (regularMarketPrice/regularMarketTime) dipakai utk liveTick
    polling harga TANPA request tambahan. */
async function fetchYahooPage(
  ySym: string, iv: string, opts: { range?: string; period1?: number; period2?: number }, symbol: string,
): Promise<{ rows: YahooCandle[]; meta: any } | null> {
  const info = FOREX_SYMBOLS[symbol]
  if (!info) return null
  const qs = opts.range
    ? `interval=${iv}&range=${opts.range}&includePrePost=false`
    : `interval=${iv}&period1=${opts.period1}&period2=${opts.period2}&includePrePost=false`
  const path = `/v8/finance/chart/${encodeURIComponent(ySym)}?${qs}`
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
      if (!res.ok) continue // → host berikutnya
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      if (!result) continue // body tidak berisi chart → host berikutnya
      return { rows: parseYahooChart(json, symbol), meta: result.meta || {} }
    } catch { continue }
  }
  return null
}

/** Parse body /v8/finance/chart → candle (validasi harga, rounding desimal) */
function parseYahooChart(json: any, symbol: string): YahooCandle[] {
  const info = FOREX_SYMBOLS[symbol]
  if (!info) return []
  const result = json?.chart?.result?.[0]
  if (!result) return []
  const timestamps: number[] = result.timestamp || []
  const quote = result.indicators?.quote?.[0]
  if (!quote || !timestamps.length) return []

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
  return candles
}

/** Gabungkan halaman-halaman → dedup per open-time + urut KRONOLOGIS (lama→baru) */
function mergeChronological(pages: YahooCandle[][]): YahooCandle[] {
  const seen = new Map<number, YahooCandle>()
  for (const page of pages) for (const c of page) seen.set(c.time, c)
  return [...seen.values()].sort((a, b) => a.time - b.time)
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
 *
 * KEDALAMAN (Bos: 3.000–5.000 bar, bukan lagi 500):
 *   - limit ≤ 400 (traffic watchlist/polling) → SATU request `range`
 *     seperti dulu — cepat, hemat.
 *   - limit > 400 (chart Vela + Pine backtest) → PAGINATION mundur
 *     pakai period1/period2: halaman chunkDays hari digali sampai
 *     jumlah bar terpenuhi ATAU batas window interval (60d intraminut,
 *     730d untuk 1h) tercapai. Halaman digabung via mergeChronological
 *     → array AKHIR KRONOLOGIS (ascending lama → baru), dedup.
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
  const depth = YAHOO_DEPTH[interval] || YAHOO_DEPTH['1h']
  const want = Math.max(limit, 1)
  const deep = want > 400

  const pages: YahooCandle[][] = []
  let liveMeta: any = null

  if (!deep) {
    /* ---- FAST PATH: satu request range (perilaku lama) ---- */
    const page = await fetchYahooPage(ySym, cfg.iv, { range: cfg.range }, symbol)
    if (page) {
      if (page.rows.length) pages.push(page.rows)
      liveMeta = page.meta
    }
  } else {
    /* ---- DEEP PATH: paging mundur period1/period2 ----
       Dari "sekarang" ke belakang per chunkDays hari sampai bar
       terkumpul ≥ want, window habis, ATAU Yahoo berhenti menyodok
       data (2 halaman kosong berurutan). */
    const nowSec = Math.floor(Date.now() / 1000)
    const oldestAllowed = nowSec - depth.maxDays * 86400
    const chunk = depth.chunkDays * 86400
    const maxPages = Math.ceil((depth.maxDays * 86400) / chunk) + 1
    let period2 = nowSec
    let emptyStreak = 0

    for (let page = 0; page < maxPages; page++) {
      const period1 = Math.max(period2 - chunk, oldestAllowed)
      const resp = await fetchYahooPage(ySym, cfg.iv, { period1, period2 }, symbol)
      const rows = resp?.rows || []
      if (rows.length) {
        pages.push(rows)
        emptyStreak = 0
      } else {
        emptyStreak++
        /* Halaman kosong: bila sudah punya data → sejarah di bawahnya
           pasti habis (window terlalu tua utk interval ini) → stop.
           Bila belum punya apa-apa → coba satu halaman lagi. */
        if (pages.length || emptyStreak >= 2) break
      }
      if (!liveMeta && resp?.meta) liveMeta = resp.meta // halaman TERBARU
      if (pages.reduce((s, p) => s + p.length, 0) >= want) break
      if (period1 <= oldestAllowed) break
      period2 = period1 - 1
    }
  }

  if (!pages.length) return null

  /* MERGE KRONOLOGIS lintas halaman → agregasi 2h/4h → potong limit */
  const merged = mergeChronological(pages)
  const aggregated = cfg.agg ? aggregate(merged, cfg.agg) : merged
  aggregated.sort((a, b) => a.time - b.time)
  if (!aggregated.length) return null

  let out = aggregated.slice(-want)

  /* Live tick: regularMarketPrice lebih baru dari candle terakhir
     (polling harga) — dari meta respons, TANPA request tambahan */
  const currentPrice = Number(liveMeta?.regularMarketPrice)
  const lastTradeTime = Number(liveMeta?.regularMarketTime)
  if (liveTick && currentPrice > 0 && lastTradeTime > 0 && out.length) {
    const last = out[out.length - 1]
    if (lastTradeTime > last.time && validatePrice(symbol, currentPrice) !== null) {
      out.push({
        time: lastTradeTime,
        open: last.close,
        high: Math.max(last.high, currentPrice),
        low: Math.min(last.low, currentPrice),
        close: parseFloat(currentPrice.toFixed(info.decimals)),
      })
    }
  }

  return out
}
