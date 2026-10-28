/**
 * ============================================================
 * server-candles — candle OHLC untuk KEPERLUAN SERVER (Task 41)
 * ============================================================
 * Dipakai /api/compile-pine (Protected Pine Script®): engine
 * PineTS di server butuh bars. Urutan sumber:
 *
 *   1. OANDA   — forex & logam (XAUUSD, EURUSD, …) — akurat + live
 *   2. Yahoo   — indeks US100/NAS100 (futures NQ=F ≈ CFD US100)
 *                + fallback forex bila OANDA belum dipasang
 *   3. Binance — crypto (BTCUSDT dll.)
 *
 * Semua fetch di server; kunci API tidak pernah keluar.
 */

import { fetchOandaCandles, oandaToLux, isOandaSymbol, type LuxCandle } from './oanda'

/** Interval kanonik ('5m','1h','1d',…) → detik per bar (untuk dedupe & validasi) */
const INTERVAL_SECONDS: Record<string, number> = {
  '5m': 300, '15m': 900, '30m': 1800, '1h': 3600,
  '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800,
}

export function intervalSeconds(interval: string): number {
  return INTERVAL_SECONDS[interval] || 3600
}

/* ---------- 2) YAHOO — US100 (NQ=F futures) + fallback forex ---------- */

const YAHOO_SYMBOLS: Record<string, string> = {
  US100: 'NQ=F', // Nasdaq 100 futures ≈ US100/NAS100 CFD (hampir 24 jam)
  NAS100: 'NQ=F',
  XAUUSD: 'GC=F',
  XAGUSD: 'SI=F',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'USDJPY=X',
  EURGBP: 'EURGBP=X',
  EURJPY: 'EURJPY=X',
  GBPJPY: 'GBPJPY=X',
  AUDUSD: 'AUDUSD=X',
  NZDUSD: 'NZDUSD=X',
  USDCAD: 'USDCAD=X',
  USDCHF: 'USDCHF=X',
}

const YAHOO_INTERVALS: Record<string, { iv: string; range: string }> = {
  '5m': { iv: '5m', range: '5d' },
  '15m': { iv: '15m', range: '1mo' },
  '30m': { iv: '30m', range: '1mo' },
  '1h': { iv: '1h', range: '3mo' },
  '2h': { iv: '1h', range: '6mo' },
  '4h': { iv: '1h', range: '6mo' },
  '1d': { iv: '1d', range: '1y' },
  '1w': { iv: '1wk', range: '2y' },
}

export async function fetchYahooCandles(
  symbol: string,
  interval: string,
  limit: number,
): Promise<LuxCandle[] | null> {
  const ySym = YAHOO_SYMBOLS[symbol]
  if (!ySym) return null
  const cfg = YAHOO_INTERVALS[interval]
  if (!cfg) return null
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}` +
    `?interval=${cfg.iv}&range=${cfg.range}`
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LuxtradeeBot/1.0)' },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(tid)
    if (!res.ok) return null
    const json: any = await res.json()
    const r = json?.chart?.result?.[0]
    const ts: number[] = r?.timestamp || []
    const q = r?.indicators?.quote?.[0]
    if (!ts.length || !q) return null
    const out: LuxCandle[] = []
    for (let i = 0; i < ts.length; i++) {
      const o = Number(q.open?.[i]), h = Number(q.high?.[i]), l = Number(q.low?.[i]), c = Number(q.close?.[i])
      if (!Number.isFinite(o) || !Number.isFinite(c) || c <= 0) continue
      out.push({
        time: ts[i],
        open: o,
        high: Number.isFinite(h) ? h : Math.max(o, c),
        low: Number.isFinite(l) ? l : Math.min(o, c),
        close: c,
        volume: Number.isFinite(Number(q.volume?.[i])) ? Number(q.volume?.[i]) : undefined,
      })
    }
    // 2h/4h: agregasi dari candle 1h Yahoo (Yahoo tak menyediakan langsung)
    const agg = interval === '2h' || interval === '4h' ? aggregate(out, interval === '2h' ? 2 : 4) : out
    agg.sort((a, b) => a.time - b.time)
    const sliced = agg.length > limit ? agg.slice(-limit) : agg
    return sliced.length ? sliced : null
  } catch {
    return null
  }
}

/** Gabungkan n candle 1 jam jadi 1 candle n-jam (baris wajib rapi utk Pine) */
function aggregate(candles: LuxCandle[], n: number): LuxCandle[] {
  const out: LuxCandle[] = []
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

/* ---------- 3) BINANCE — crypto (BTCUSDT, ETHUSDT, …) ---------- */

const BINANCE_INTERVALS: Record<string, string> = {
  '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h',
  '2h': '2h', '4h': '4h', '1d': '1d', '1w': '1W',
}

const CRYPTO_HINT = /^(BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|MATIC|LINK|LTC|TRX|TON|SUI|PEPE)(USDT?|USD)$/i

export function isCryptoSymbol(symbol: string): boolean {
  return CRYPTO_HINT.test(symbol)
}

async function fetchBinanceCandles(
  symbol: string,
  interval: string,
  limit: number,
): Promise<LuxCandle[] | null> {
  const iv = BINANCE_INTERVALS[interval]
  if (!iv) return null
  const sym = symbol.toUpperCase().endsWith('USD') && !symbol.toUpperCase().endsWith('USDT')
    ? `${symbol.toUpperCase()}T` // BTCUSD → BTCUSDT
    : symbol.toUpperCase()
  const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${iv}&limit=${Math.min(limit, 500)}`
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(tid)
    if (!res.ok) return null
    const rows: any[] = await res.json()
    if (!Array.isArray(rows)) return null
    const out: LuxCandle[] = rows.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]), close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    })).filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0)
    return out.length ? out : null
  } catch {
    return null
  }
}

/**
 * Sumber candle TERPADU untuk server (compile-pine dll).
 * Prioritas: OANDA (fx/logam) → Yahoo (indeks + fallback fx) → Binance (crypto).
 * Return null bila semua gagal — penelepon wajib jawab 502 jujur (TANPA mock).
 */
export async function fetchServerCandles(
  symbol: string,
  interval: string,
  limit = 300,
): Promise<{ bars: LuxCandle[]; source: string } | null> {
  const errors: string[] = []

  // 1) OANDA — akurasi tertinggi untuk forex & gold
  if (isOandaSymbol(symbol)) {
    const oa = await fetchOandaCandles(symbol, interval, limit)
    if (oa && oa.length) return { bars: oandaToLux(oa), source: 'oanda' }
    errors.push(`OANDA: ${hasOandaKey() ? 'tidak ada data' : 'OANDA_API_KEY belum dipasang'}`)
  }

  // 2) Yahoo — US100 + fallback forex/logam
  const yf = await fetchYahooCandles(symbol, interval, limit)
  if (yf && yf.length) return { bars: yf, source: 'yahoo' }
  errors.push('Yahoo: tidak ada data')

  // 3) Binance — crypto
  if (isCryptoSymbol(symbol)) {
    const bn = await fetchBinanceCandles(symbol, interval, limit)
    if (bn && bn.length) return { bars: bn, source: 'binance' }
    errors.push('Binance: tidak ada data')
  }

  console.error(`[ServerCandles] semua sumber gagal utk ${symbol} ${interval}: ${errors.join('; ')}`)
  return null
}
