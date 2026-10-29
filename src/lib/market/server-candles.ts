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
import { readStickySource, writeStickySource } from './source-sticky'

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
 * STICKY SOURCE (lib bersama source-sticky.ts — SAMA dengan /api/candles):
 * sumber sukses terakhir utk (symbol,interval) dicoba dulu — supaya
 * BACKTEST PINE dihitung pada skala harga yang SAMA dengan chart
 * (spot OANDA vs futures GC=F beda $10–40 → garis Entry/SL/TP bisa
 * geser kalau sumbernya beda). Urutan kanonik: TradingView (keyless)
 * → Twelve Data (key) → Yahoo (keyless). Return null bila semua gagal.
 */
export async function fetchServerCandles(
  symbol: string,
  interval: string,
  limit = 300,
): Promise<{ bars: LuxCandle[]; source: string } | null> {
  const errors: string[] = []
  const stickyKey = `${symbol}:${interval}`

  const CHAIN: Array<{ name: string; run: () => Promise<LuxCandle[] | null> }> = [
    { name: 'tradingview', run: () => fetchTradingViewCandles(symbol, interval, limit) },
    { name: 'twelvedata', run: () => fetchTwelveDataCandles(symbol, interval, limit) },
    { name: 'yahoo-finance', run: () => fetchYahooChart(symbol, interval, limit, false) },
  ]
  const sticky = await readStickySource(stickyKey)
  const ordered = sticky
    ? [...CHAIN.filter((c) => c.name === sticky), ...CHAIN.filter((c) => c.name !== sticky)]
    : CHAIN

  for (const c of ordered) {
    try {
      const bars = await c.run()
      if (bars && bars.length) {
        void writeStickySource(stickyKey, c.name)
        return { bars, source: c.name }
      }
      if (c.name === 'twelvedata' && process.env.TWELVE_DATA_API_KEY) errors.push('TwelveData: tidak ada data')
      else if (c.name !== 'twelvedata' || process.env.TWELVE_DATA_API_KEY) errors.push(`${c.name}: tidak ada data`)
    } catch (e: any) {
      errors.push(`${c.name}: ${String(e?.message || e).slice(0, 80)}`)
    }
  }

  console.error(`[ServerCandles] semua sumber gagal utk ${symbol} ${interval}: ${errors.join('; ')}`)
  return null
}
