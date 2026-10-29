/**
 * ============================================================
 * finnhub.ts — fetcher candle Finnhub (butuh FINNHUB_API_KEY)
 * ============================================================
 * PARKIR (keputusan Bos): TIDAK DIPAKAI di rantai candle — urutan
 * final rantai adalah TradingView → TwelveData → Yahoo (Binance
 * dihapus). File ini dipertahankan bila kelak Bos ingin memakai
 * Finnhub lagi. API resmi Finnhub — forex via OANDA:, crypto
 * via BINANCE:. TANPA key → langsung null (skip, bukan error).
 *
 * Endpoint:
 *   /api/v1/forex/candle?symbol=OANDA:XAU_USD&resolution=60&count=300
 *   /api/v1/crypto/candle?symbol=BINANCE:BTCUSDT&resolution=60&count=300
 * Respons: { s: "ok"|"no_data", t[], o[], h[], l[], c[], v[] }
 *
 * HANYA untuk server (API route).
 */

import type { YahooCandle } from './yahoo'

const BASE = 'https://finnhub.io/api/v1'

/* ---------- Simbol → format Finnhub (null = tidak didukung) ---------- */
const FINNHUB_SYMBOLS: Record<string, string | null> = {
  'XAUUSD': 'OANDA:XAU_USD',
  'XAGUSD': 'OANDA:XAG_USD',
  'EURUSD': 'OANDA:EUR_USD',
  'GBPUSD': 'OANDA:GBP_USD',
  'USDJPY': 'OANDA:USD_JPY',
  'EURGBP': 'OANDA:EUR_GBP',
  'EURJPY': 'OANDA:EUR_JPY',
  'GBPJPY': 'OANDA:GBP_JPY',
  'AUDUSD': 'OANDA:AUD_USD',
  'NZDUSD': 'OANDA:NZD_USD',
  'USDCAD': 'OANDA:USD_CAD',
  'USDCHF': 'OANDA:USD_CHF',
  'US100': null, // indeks: candle index butuh paket lebih tinggi → skip
  'BTCUSDT': 'BINANCE:BTCUSDT',
  'ETHUSDT': 'BINANCE:ETHUSDT',
  'SOLUSDT': 'BINANCE:SOLUSDT',
  'XRPUSDT': 'BINANCE:XRPUSDT',
  'DOGEUSDT': 'BINANCE:DOGEUSDT',
  'ADAUSDT': 'BINANCE:ADAUSDT',
  'LTCUSDT': 'BINANCE:LTCUSDT',
  'BNBUSDT': 'BINANCE:BNBUSDT',
  'LINKUSDT': 'BINANCE:LINKUSDT',
  'AVAXUSDT': 'BINANCE:AVAXUSDT',
}

const FINNHUB_RESOLUTIONS: Record<string, string> = {
  '5m': '5', '15m': '15', '30m': '30', '1h': '60',
  '2h': '120', '4h': '240', '1d': 'D', '1w': 'W',
}

export function finnhubSymbol(symbol: string): string | null {
  const s = String(symbol || '').trim().toUpperCase()
  if (!s) return null
  if (s in FINNHUB_SYMBOLS) return FINNHUB_SYMBOLS[s]
  /* Crypto generik *USDT → BINANCE: */
  if (/^[A-Z0-9]{2,10}USDT$/.test(s)) return `BINANCE:${s}`
  return null
}

/**
 * Ambil candle OHLC dari Finnhub. Tanpa FINNHUB_API_KEY → null (skip).
 */
export async function fetchFinnhubCandles(
  symbol: string,
  interval: string,
  limit = 300,
): Promise<YahooCandle[] | null> {
  const key = String(process.env.FINNHUB_API_KEY || '').trim()
  if (!key) return null

  const fhSymbol = finnhubSymbol(symbol)
  const resolution = FINNHUB_RESOLUTIONS[interval]
  if (!fhSymbol || !resolution) return null
  const isCrypto = fhSymbol.startsWith('BINANCE:')
  const kind = isCrypto ? 'crypto' : 'forex'

  const url = `${BASE}/${kind}/candle?symbol=${encodeURIComponent(fhSymbol)}&resolution=${resolution}&count=${Math.min(Math.max(limit, 10), 1000)}&token=${encodeURIComponent(key)}`
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(tid)
    if (!res.ok) return null
    const j: any = await res.json().catch(() => null)
    if (!j || j.s !== 'ok' || !Array.isArray(j.t) || !j.t.length) return null
    const out: YahooCandle[] = j.t
      .map((t: number, i: number) => ({
        time: Number(t),
        open: Number(j.o?.[i]), high: Number(j.h?.[i]),
        low: Number(j.l?.[i]), close: Number(j.c?.[i]),
        volume: j.v?.[i] != null ? Number(j.v[i]) : undefined,
      }))
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0)
    if (!out.length) return null
    out.sort((a, b) => a.time - b.time)
    const seen = new Map<number, YahooCandle>()
    for (const c of out) seen.set(c.time, c)
    const uniq = [...seen.values()]
    return uniq.slice(Math.max(0, uniq.length - limit))
  } catch {
    return null
  }
}
