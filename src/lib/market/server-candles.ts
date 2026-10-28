/**
 * ============================================================
 * server-candles — candle OHLC untuk KEPERLUAN SERVER (keyless)
 * ============================================================
 * Dipakai /api/compile-pine (Protected Pine Script®): engine
 * PineTS di server butuh bars. Urutan sumber:
 *
 *   1. Yahoo   — forex, logam (XAUUSD), & indeks US100 (NQ=F)
 *                via lib bersama src/lib/market/yahoo.ts
 *   2. Binance — crypto (BTCUSDT dll.)
 *
 * Semua sumber PUBLIK & TANPA API KEY → tidak ada kunci yang
 * bisa bocor, tidak ada error 401. Semua fetch di server.
 * (Datafeed CHART VELA memakai /api/candles — juga keyless:
 * Yahoo publik — bukan dari sini.)
 */

import { fetchYahooChart, type YahooCandle } from './yahoo'

/** Interval kanonik ('5m','1h','1d',…) → detik per bar (untuk dedupe & validasi) */
const INTERVAL_SECONDS: Record<string, number> = {
  '5m': 300, '15m': 900, '30m': 1800, '1h': 3600,
  '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800,
}

export function intervalSeconds(interval: string): number {
  return INTERVAL_SECONDS[interval] || 3600
}

/* ---------- Bentuk candle generik Luxtradee { time(sec), open, high, low, close, volume } ---------- */
export type LuxCandle = YahooCandle

/* ---------- 1) YAHOO — forex, logam (XAUUSD), indeks US100 ---------- */
export async function fetchYahooCandles(
  symbol: string,
  interval: string,
  limit: number,
): Promise<LuxCandle[] | null> {
  return fetchYahooChart(symbol, interval, limit, false)
}

/* ---------- 2) BINANCE — crypto (BTCUSDT, ETHUSDT, …) — publik, tanpa key ---------- */

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
 * Prioritas: Yahoo (fx/logam/indeks) → Binance (crypto).
 * Return null bila semua gagal — penelepon wajib jawab 502 jujur (TANPA mock).
 */
export async function fetchServerCandles(
  symbol: string,
  interval: string,
  limit = 300,
): Promise<{ bars: LuxCandle[]; source: string } | null> {
  const errors: string[] = []

  // 1) Yahoo — forex, gold, US100
  const yf = await fetchYahooCandles(symbol, interval, limit)
  if (yf && yf.length) return { bars: yf, source: 'yahoo' }
  errors.push('Yahoo: tidak ada data')

  // 2) Binance — crypto
  if (isCryptoSymbol(symbol)) {
    const bn = await fetchBinanceCandles(symbol, interval, limit)
    if (bn && bn.length) return { bars: bn, source: 'binance' }
    errors.push('Binance: tidak ada data')
  }

  console.error(`[ServerCandles] semua sumber gagal utk ${symbol} ${interval}: ${errors.join('; ')}`)
  return null
}
