/**
 * ============================================================
 * OANDA v20 REST client (server-side only!) — Task 41
 * ============================================================
 * Sumber data forex/gold utama Luxtradee: candle bentukan pasar
 * sungguhan OANDA (bukan futures proxy) → bentuk candle & harga
 * XAUUSD/forex jauh lebih akurat dan real-time.
 *
 * Keamanan: OANDA_API_KEY HANYA dibaca di sini (API route / lib
 * server). Token TIDAK PERNAH dikirim ke browser — client hanya
 * menerima hasil candle via /api/forex & /api/compile-pine.
 *
 * Env (Cloudflare → Settings → Variables & Secrets):
 *   OANDA_API_KEY — token personal access (practice / live)
 *   OANDA_ENV     — 'practice' (default) | 'live'
 *
 * Docs: GET /v3/instruments/{instrument}/candles
 *   granularitas: M5 M15 M30 H1 H2 H4 D W (price=M → mid OHLC)
 * ============================================================
 */

export const OANDA_INSTRUMENTS: Record<string, string> = {
  XAUUSD: 'XAU_USD',
  XAGUSD: 'XAG_USD',
  EURUSD: 'EUR_USD',
  GBPUSD: 'GBP_USD',
  USDJPY: 'USD_JPY',
  EURGBP: 'EUR_GBP',
  EURJPY: 'EUR_JPY',
  GBPJPY: 'GBP_JPY',
  AUDUSD: 'AUD_USD',
  NZDUSD: 'NZD_USD',
  USDCAD: 'USD_CAD',
  USDCHF: 'USD_CHF',
}

/* Interval format /api/forex ('5m','1h',…) → granularitas OANDA */
const OANDA_GRANULARITY: Record<string, string> = {
  '5m': 'M5',
  '15m': 'M15',
  '30m': 'M30',
  '1h': 'H1',
  '2h': 'H2',
  '4h': 'H4',
  '1d': 'D',
  '1w': 'W',
}

export interface OandaCandle {
  time: number // epoch DETIK (open time)
  open: number
  high: number
  low: number
  close: number
  volume: number
  complete: boolean
}

function oandaHost(): string {
  const env = String(process.env.OANDA_ENV || 'practice').trim().toLowerCase()
  return env === 'live' ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com'
}

function oandaKey(): string {
  const v = process.env.OANDA_API_KEY
  return typeof v === 'string' ? v.trim() : ''
}

/** Simbol dukung OANDA? (US100 dll. TIDAK — OANDA hanya FX/logam) */
export function isOandaSymbol(symbol: string): boolean {
  return symbol in OANDA_INSTRUMENTS
}

/** Kunci OANDA terpasang? (untuk log/status API) */
export function hasOandaKey(): boolean {
  return oandaKey().length >= 16
}

/**
 * Ambil candle OHLC (mid price) dari OANDA.
 * Mencakup candle yang sedang berjalan (complete=false) → chart
 * polling Vela tetap menunjukkan pergerakan live.
 * Returns null bila key belum dipasang / simbol tak didukung /
 * error jaringan (pemanggil melanjutkan ke sumber fallback).
 */
export async function fetchOandaCandles(
  symbol: string,
  interval: string,
  limit: number,
): Promise<OandaCandle[] | null> {
  const key = oandaKey()
  if (!key) return null
  const instrument = OANDA_INSTRUMENTS[symbol]
  if (!instrument) return null
  const granularity = OANDA_GRANULARITY[interval]
  if (!granularity) return null

  const count = Math.min(Math.max(1, limit), 500) // batas aman OANDA
  const url =
    `https://${oandaHost()}/v3/instruments/${instrument}/candles` +
    `?granularity=${granularity}&count=${count}&price=M`

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Accept-Datetime-Format': 'UNIX',
      },
      signal: controller.signal,
      // OANDA selalu fresh — jangan biarkan platform cache respons
      cache: 'no-store',
    })
    clearTimeout(tid)
    if (!res.ok) {
      console.error(`[OANDA] HTTP ${res.status} untuk ${instrument} ${granularity}`)
      return null
    }
    const json: any = await res.json()
    const rows: any[] = Array.isArray(json?.candles) ? json.candles : []
    if (!rows.length) return null

    const out: OandaCandle[] = []
    for (const r of rows) {
      const mid = r?.mid || {}
      const o = Number(mid.o), h = Number(mid.h), l = Number(mid.l), c = Number(mid.c)
      const t = Number(r?.time)
      if (!Number.isFinite(t) || !Number.isFinite(o) || !Number.isFinite(c)) continue
      out.push({
        time: t, // UNIX detik (Accept-Datetime-Format: UNIX)
        open: o, high: h, low: l, close: c,
        volume: Number(r?.volume) || 0,
        complete: r?.complete === true,
      })
    }
    out.sort((a, b) => a.time - b.time)
    return out.length ? out : null
  } catch (x: any) {
    console.error(`[OANDA] gagal fetch ${instrument}:`, String(x?.message || x).slice(0, 120))
    return null
  }
}

/* ---------- Bentuk candle generik Luxtradee { time(sec), open, high, low, close, volume } ---------- */
export interface LuxCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export function oandaToLux(candles: OandaCandle[]): LuxCandle[] {
  return candles.map((c) => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }))
}
