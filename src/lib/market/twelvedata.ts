/**
 * ============================================================
 * twelvedata — klien Twelve Data® time_series (SERVER-ONLY)
 * ============================================================
 * Sumber candle SPOT-grade untuk forex & logam (XAU/USD dkk) —
 * level harganya paling dekat dengan feed broker (OANDA/MT4/MT5)
 * dibanding Yahoo yang berbasis futures (GC=F/NQ=F).
 *
 * ATURAN AMAN (tanpa risiko 401 di UI):
 *   - API key dibaca dari process.env.TWELVE_DATA_API_KEY.
 *     TANPA key → return null, penelepon otomatis jatuh ke
 *     Yahoo keyless → aplikasi tetap hidup 100%.
 *   - Free tier Twelve Data = 8 req/menit → rate limiter lokal
 *     (maks 7/menit, sliding window) + cooldown 60 detik setelah
 *     error apa pun (quota/plan/network) → Yahoo yang ambil alih.
 *   - SEMUA kesalahan → null (JANGAN pernah mock data).
 *
 * Pemetaan simbol kanonik Luxtradee → Twelve Data:
 *   XAUUSD → XAU/USD, XAGUSD → XAG/USD (spot metal)
 *   EURUSD → EUR/USD, dst. (semua major di FOREX_SYMBOLS)
 *   US100  → NDX (indeks; bila plan tidak mencakup → fallback
 *            Yahoo NQ=F yang level harganya setara Nasdaq 100.
 *            QQQ sengaja TIDAK dipakai — levelnya ~490 vs NDX ~21rb
 *            bakal merusak skala chart.)
 *
 * Interval kanonik → Twelve Data:
 *   5m→5min, 15m→15min, 30m→30min, 1h→1h, 2h→2h, 4h→4h,
 *   1d→1day, 1w→1week
 *
 * Format candle keluaran = LuxCandle standar Luxtradee:
 *   { time: epoch DETIK (UTC), open, high, low, close, volume? }
 */

import type { LuxCandle } from './server-candles'

const TD_BASE = 'https://api.twelvedata.com/time_series'

/* ---------- Pemetaan simbol ---------- */
const TD_SYMBOLS: Record<string, string> = {
  XAUUSD: 'XAU/USD',
  XAGUSD: 'XAG/USD',
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  USDJPY: 'USD/JPY',
  EURGBP: 'EUR/GBP',
  EURJPY: 'EUR/JPY',
  GBPJPY: 'GBP/JPY',
  AUDUSD: 'AUD/USD',
  NZDUSD: 'NZD/USD',
  USDCAD: 'USD/CAD',
  USDCHF: 'USD/CHF',
  US100: 'NDX',
}

/* ---------- Pemetaan interval ---------- */
const TD_INTERVALS: Record<string, string> = {
  '5m': '5min', '15m': '15min', '30m': '30min',
  '1h': '1h', '2h': '2h', '4h': '4h',
  '1d': '1day', '1w': '1week',
}

/** Simbol ini didukung Twelve Data? (server cukup panggil sekali per request) */
export function tdSupports(symbol: string): boolean {
  return Boolean(TD_SYMBOLS[symbol.toUpperCase()])
}

/** Interval kanonik didukung Twelve Data? */
export function tdSupportsInterval(interval: string): boolean {
  return Boolean(TD_INTERVALS[interval])
}

/* ============================================================
   RATE LIMITER — free tier 8 req/min → jaga maks 7/menit
   ============================================================ */
const RATE_MAX = 7
const RATE_WINDOW_MS = 60_000
const COOLDOWN_MS = 60_000

let rateHits: number[] = []
let cooldownUntil = 0

function rateOk(): boolean {
  const now = Date.now()
  if (now < cooldownUntil) return false
  rateHits = rateHits.filter((t) => now - t < RATE_WINDOW_MS)
  if (rateHits.length >= RATE_MAX) return false
  rateHits.push(now)
  return true
}

function enterCooldown(): void {
  cooldownUntil = Date.now() + COOLDOWN_MS
}

/** Test-hook: reset state rate limiter (dipakai smoke test lokal) */
export function _tdResetLimiter(): void {
  rateHits = []
  cooldownUntil = 0
}

/* ============================================================
   PARSER datetime Twelve Data — SELALU UTC
   ============================================================ */
/**
 * TD mengembalikan "2024-05-01 10:30:00" (tanpa zona) — dengan
 * parameter timezone=UTC di query, string ini PASTI UTC.
 * new Date(...) Node mem-parsing sbg waktu LOKAL → bahaya geser
 * jam. Parse manual pakai Date.UTC.
 * Output: epoch DETIK. Return NaN bila format tak dikenal.
 */
export function parseTdDatetimeUtc(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || '').trim())
  if (!m) {
    const fallback = new Date(String(s)).getTime()
    return Number.isFinite(fallback) ? Math.floor(fallback / 1000) : NaN
  }
  const [, y, mo, d, h, mi, sec] = m
  return Math.floor(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec || '0')) / 1000)
}

/* ============================================================
   FETCH utama — return null pada SEMUA kegagalan (fallback Yahoo)
   ============================================================
   KEDALAMAN (Bos: 3.000–5.000 bar history, bukan lagi 500):
   - Twelve Data menerima outputsize sampai 5000 bar DALAM SATU
     REQUEST → 3000/5000 bar terpenuhi tanpa pagination.
   - Permintaan >5000 → loop PAGINATION resmi TD: meta.previous_close
     dari respons dipakai sbg kursor halaman berikutnya; halaman-halaman
     digabung, di-dedup per open-time, lalu diurut KRONOLOGIS
     (ascending lama → baru) sebelum dikembalikan.
   - Free tier 8 req/min: tiap halaman makan jatah rate limiter;
     bila jatah habis di tengah jalan → data parsial yang sudah ada
     tetap dikembalikan (tidak pernah buang hasil). */
export async function fetchTwelveDataCandles(
  symbol: string,
  interval: string,
  limit: number,
): Promise<LuxCandle[] | null> {
  const key = String(process.env.TWELVE_DATA_API_KEY || '').trim()
  if (!key) return null // tanpa key → Yahoo keyless yang bekerja

  const sym = symbol.toUpperCase()
  const tdSym = TD_SYMBOLS[sym]
  const tdIv = TD_INTERVALS[interval]
  if (!tdSym || !tdIv) return null
  if (!rateOk()) return null // kuota 8/min terjaga — Yahoo ambil alih

  const want = Math.min(Math.max(limit, 1), 20000)
  const PAGE = 5000 // maksimum resmi outputsize TD per request
  const maxPages = Math.min(Math.ceil(want / PAGE), 6)

  const all: LuxCandle[] = []
  let cursor: string | null = null

  for (let page = 0; page < maxPages && all.length < want; page++) {
    const remaining = want - all.length
    const url =
      `${TD_BASE}?symbol=${encodeURIComponent(tdSym)}` +
      `&interval=${encodeURIComponent(tdIv)}` +
      `&outputsize=${Math.min(remaining, PAGE)}` +
      `&timezone=UTC&apikey=${encodeURIComponent(key)}` +
      (cursor ? `&previous_close=${encodeURIComponent(cursor)}` : '')

    let json: any
    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 10_000)
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
      clearTimeout(tid)

      if (res.status === 429 || res.status === 401 || res.status === 402 || res.status === 403) {
        // quota / plan / key salah → pendinginkan TD, jangan hammer
        enterCooldown()
        console.warn(`[TwelveData] HTTP ${res.status} (${tdSym} ${tdIv}) → cooldown 60s, fallback Yahoo`)
        return all.length ? all : null // parsial tetap dipakai bila ada
      }
      if (!res.ok) {
        enterCooldown()
        return all.length ? all : null
      }

      json = await res.json()
    } catch (x: any) {
      enterCooldown()
      console.warn(`[TwelveData] fetch gagal (${tdSym}): ${String(x?.message || x).slice(0, 100)} → fallback Yahoo`)
      return all.length ? all : null
    }

    /* Bentuk error TD: { code, message, status: "error" } */
    if (json?.status === 'error' || json?.code === 429 || json?.code === 401) {
      enterCooldown()
      console.warn(`[TwelveData] API error utk ${tdSym}: ${String(json?.message || '').slice(0, 120)} → fallback Yahoo`)
      return all.length ? all : null
    }

    const values: any[] = Array.isArray(json?.values) ? json.values : []
    if (!values.length) break // habis / simbol tak tersedia di plan ini

    /* values datang TERBARU dulu → dinormalisasi di merge bawah */
    for (const v of values) {
      all.push({
        time: parseTdDatetimeUtc(v?.datetime),
        open: Number(v?.open), high: Number(v?.high),
        low: Number(v?.low), close: Number(v?.close),
        volume: v?.volume != null && String(v.volume) !== '' ? Number(v.volume) : undefined,
      })
    }

    /* Kursor pagination: meta.previous_close = datetime tepat sebelum
       bar tertua di halaman ini. Tidak ada → history habis. */
    const nextCursor = json?.meta?.previous_close
    if (!nextCursor || String(nextCursor).trim() === '' || String(nextCursor) === 'null') break
    cursor = String(nextCursor)

    /* Halaman berikutnya butuh jatah rate — habis → berhenti elegan */
    if (page + 1 < maxPages && all.length < want && !rateOk()) break
  }

  /* MERGE KRONOLOGIS — dedup per open-time, urut ASCENDING (lama→baru).
     Kontrak Vela: sorted + de-duplicated. */
  const seen = new Map<number, LuxCandle>()
  for (const c of all) {
    if (Number.isFinite(c.time) && c.time > 0 &&
        Number.isFinite(c.open) && Number.isFinite(c.close) &&
        c.open > 0 && c.close > 0 && c.high >= c.low) {
      seen.set(c.time, c)
    }
  }
  if (!seen.size) return null
  const out = [...seen.values()].sort((a, b) => a.time - b.time)
  return out.length ? out : null
}
