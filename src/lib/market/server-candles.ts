/**
 * ============================================================
 * server-candles — candle OHLC untuk KEPERLUAN SERVER (spot dulu)
 * ============================================================
 * Dipakai /api/compile-pine (Protected Pine Script®) + alert runner:
 * engine PineTS di server butuh bars. Urutan sumber FINAL (Bos,
 * dikonfirmasi 3× — verbatim: "binaance yang dibuang"):
 *
 *   0. TradingView — websocket publik KEYLESS, grade broker
 *      (OANDA:XAUUSD, BINANCE:BTCUSDT utk crypto) — lib tradingview.ts
 *   1. Twelve Data — SPOT forex & logam (XAU/USD dkk) via
 *      lib twelvedata.ts — butuh TWELVE_DATA_API_KEY
 *   2. Yahoo       — forex, logam (GC=F), indeks US100 (NQ=F),
 *      crypto (BTC-USD) via lib bersama yahoo.ts
 *
 * BINANCE DIBUANG (keputusan Bos) — crypto kini via TradingView /
 * Yahoo (BTC-USD). Finnhub PARKIR (butuh key, bukan pilihan Bos
 * utk rantai ini) — lib finnhub.ts dipertahankan, tidak dipanggil.
 * Semua fetch di server, tanpa mock. Return null bila semua gagal —
 * penelepon wajib jawab 502 jujur.
 */

import { fetchYahooChart, type YahooCandle } from './yahoo'
import { fetchTwelveDataCandles } from './twelvedata'
import { fetchTradingViewCandles } from './tradingview'

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

/**
 * Sumber candle TERPADU untuk server (compile-pine, alert runner, dll).
 * Urutan FINAL Bos: TradingView (keyless) → Twelve Data (key)
 * → Yahoo (keyless). Return null bila semua gagal.
 */
export async function fetchServerCandles(
  symbol: string,
  interval: string,
  limit = 300,
): Promise<{ bars: LuxCandle[]; source: string } | null> {
  const errors: string[] = []

  // 0) TradingView — grade broker, keyless (websocket publik)
  const tv = await fetchTradingViewCandles(symbol, interval, limit)
  if (tv && tv.length) return { bars: tv, source: 'tradingview' }
  errors.push('TradingView: tidak ada data')

  // 1) Twelve Data — spot forex & logam
  const td = await fetchTwelveDataCandles(symbol, interval, limit)
  if (td && td.length) return { bars: td, source: 'twelvedata' }
  if (process.env.TWELVE_DATA_API_KEY) errors.push('TwelveData: tidak ada data')

  // 2) Yahoo — forex, gold, US100, crypto (BTC-USD)
  const yf = await fetchYahooChart(symbol, interval, limit, false)
  if (yf && yf.length) return { bars: yf, source: 'yahoo' }
  errors.push('Yahoo: tidak ada data')

  console.error(`[ServerCandles] semua sumber gagal utk ${symbol} ${interval}: ${errors.join('; ')}`)
  return null
}
