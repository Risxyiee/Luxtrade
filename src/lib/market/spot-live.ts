/**
 * ============================================================
 * spot-live.ts — OVERLAY HARGA REAL-TIME utk ujung candle (live tick)
 * ============================================================
 * MASALAH (laporan Bos: "candle ga gerak"):
 *   Jalur live /api/candles?nocache memakai rantai TradingView →
 *   TwelveData → Yahoo. Di production Cloudflare Workers, websocket
 *   TradingView sering ditolak (IP datacenter) dan TwelveData butuh
 *   key — sisa YAHOO yang datanya FX/Gold TERTINGGAL 10–20 MENIT.
 *   Akibatnya ujung candle "diam" padahal market bergerak.
 *
 * SOLUSI: overlay sumber SPOT KEYLESS yang REAL-TIME, dipakai HANYA
 * untuk mengoreksi ujung candle (tail) — sejarah tetap dari rantai
 * utama (grade lebih baik):
 *   - XAUUSD / XAGUSD → api.gold-api.com/price/{XAU|XAG}
 *     (spot grade dealer, update detik-an — sudah dipakai agent-proposals)
 *   - Crypto (BTCUSDT dll) → data-api.binance.vision klines
 *     (mirror publik resmi Binance, OHLC penuh real-time, tanpa key)
 *
 * SEMUA keyless → tidak menambah env baru. Gagal overlay = pakai
 * tail apa adanya (tidak pernah bikin jalur live mati).
 *
 * HANYA untuk server (API route).
 */

import type { YahooCandle } from './yahoo'
import { validatePrice } from './yahoo'

/* ---------- Interval kanonik → detik per bar ----------
   Menerima DUA format: kanonik ('5m','1h',…) dan format Vela dari
   route /api/candles ('5','15','60','1D',… — route mempertahankan
   input mentahnya). Tanpa ini INTERVAL_SECONDS['5'] = undefined →
   patch gagal SENYAP (inilah yang membuat overlay tak jalan). */
const INTERVAL_SECONDS: Record<string, number> = {
  '5m': 300, '15m': 900, '30m': 1800, '1h': 3600,
  '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800,
  /* format Vela (dipertahankan route /api/candles) */
  '5': 300, '15': 900, '30': 1800, '60': 3600,
  '120': 7200, '240': 14400,
  '1D': 86400, 'D': 86400, '1440': 86400,
  '1W': 604800, 'W': 604800, '10080': 604800,
}

/** Normalisasi interval (kanonik ATAU Vela) → format kanonik. */
function normInterval(interval: string): string {
  const t = String(interval || '').trim()
  const VELA_TO_CANON: Record<string, string> = {
    '5': '5m', '15': '15m', '30': '30m', '60': '1h',
    '120': '2h', '240': '4h',
    '1D': '1d', 'D': '1d', '1440': '1d',
    '1W': '1w', 'W': '1w', '10080': '1w',
  }
  return VELA_TO_CANON[t] || t
}

/** Format kanonik → interval klines Binance (data-api.binance.vision) */
const BINANCE_INTERVALS: Record<string, string> = {
  '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h',
  '2h': '2h', '4h': '4h', '1d': '1d', '1w': '1w',
}
const GOLD_API_SYMBOLS: Record<string, string> = {
  XAUUSD: 'XAU',
  XAGUSD: 'XAG',
}

const CRYPTO_BINANCE_RE = /^(BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|LINK|LTC|TRX|TON|SUI|PEPE)(USDT?|USD)$/i

export function isCryptoLiveSymbol(symbol: string): boolean {
  return CRYPTO_BINANCE_RE.test(String(symbol || '').trim().toUpperCase())
}

/** Simbol punya overlay spot real-time? (gold-api / binance-vision) */
export function hasSpotOverlay(symbol: string): boolean {
  const s = String(symbol || '').trim().toUpperCase()
  return !!GOLD_API_SYMBOLS[s] || isCryptoLiveSymbol(s)
}

/* ============================================================
   1) SPOT PRICE — gold-api (XAU/XAG) & binance ticker price
   ============================================================ */

async function fetchGoldApiPrice(apiSym: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.gold-api.com/price/${apiSym}`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    } as any)
    if (!res.ok) { console.warn('[spot-live] gold-api HTTP', res.status); return null }
    const j: any = await res.json()
    const p = Number(j?.price)
    return Number.isFinite(p) && p > 0 ? p : null
  } catch (x: any) {
    console.warn('[spot-live] gold-api gagal:', String(x?.message || x).slice(0, 100))
    return null
  }
}

async function fetchBinancePrice(bSymbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${encodeURIComponent(bSymbol)}`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    } as any)
    if (!res.ok) return null
    const j: any = await res.json()
    const p = Number(j?.price)
    return Number.isFinite(p) && p > 0 ? p : null
  } catch {
    return null
  }
}

/** Harga spot real-time (null bila simbol tanpa overlay / sumber gagal) */
export async function fetchSpotPrice(symbol: string): Promise<number | null> {
  const s = String(symbol || '').trim().toUpperCase()
  const g = GOLD_API_SYMBOLS[s]
  if (g) return fetchGoldApiPrice(g)
  if (isCryptoLiveSymbol(s)) return fetchBinancePrice(s.replace(/USD$/i, 'USDT').replace(/USDTUSDT/i, 'USDT'))
  return null
}

/* ============================================================
   2) CRYPTO TAIL — klines OHLC penuh real-time (binance-vision)
   ============================================================ */

/** Tail OHLC crypto real-time, bentuk YahooCandle (epoch detik). */
export async function fetchCryptoTail(
  symbol: string,
  interval: string,
  limit: number,
): Promise<YahooCandle[] | null> {
  const s = String(symbol || '').trim().toUpperCase()
  if (!isCryptoLiveSymbol(s)) return null
  const bi = BINANCE_INTERVALS[normInterval(interval)]
  if (!bi) return null
  const bSym = s.replace(/USD$/i, 'USDT').replace(/USDTUSDT/i, 'USDT')
  try {
    const res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(bSym)}&interval=${bi}&limit=${Math.min(Math.max(limit, 1), 100)}`, {
      signal: AbortSignal.timeout(7000),
      cache: 'no-store',
    } as any)
    if (!res.ok) return null
    const rows: any[] = await res.json()
    if (!Array.isArray(rows) || !rows.length) return null
    const out: YahooCandle[] = rows
      .map((r) => ({
        time: Math.floor(Number(r?.[0]) / 1000),
        open: Number(r?.[1]), high: Number(r?.[2]),
        low: Number(r?.[3]), close: Number(r?.[4]),
        volume: Number(r?.[5]) || undefined,
      }))
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0)
      .sort((a, b) => a.time - b.time)
    return out.length ? out : null
  } catch {
    return null
  }
}

/* ============================================================
   3) PATCH TAIL GOLD — ujung candle XAU/XAG disentuh harga spot
   ============================================================
   Yahoo tail ~10–20 menit telat → chart "diam". Harga spot
   gold-api dipakai untuk:
   a) mempatch bar yang SEDANG BERJALAN (close/high/low), dan
   b) mengisi bucket yang masih kosong (Yahoo telat membuka bar baru)
   dengan bar sintetis o=h=l=c=spot — sejarah menyusul saat refresh.
   Bar Yahoo dengan open-time tak selaras bucket dibuang (artefak tick). */

export async function patchTailWithSpot(
  symbol: string,
  interval: string,
  bars: YahooCandle[],
): Promise<YahooCandle[]> {
  const s = String(symbol || '').trim().toUpperCase()
  const g = GOLD_API_SYMBOLS[s]
  const intervalSec = INTERVAL_SECONDS[normInterval(interval)]
  if (!g || !intervalSec || !Array.isArray(bars) || !bars.length) {
    console.warn('[spot-live] patch skip:', s, interval, 'bars:', Array.isArray(bars) ? bars.length : 'bukan array')
    return bars
  }

  const spot = await fetchGoldApiPrice(g)
  if (spot == null) { console.warn('[spot-live] XAU/XAG spot tak tersedia — tail tanpa patch'); return bars }
  const valid = validatePrice(s, spot)
  if (valid == null) { console.warn('[spot-live] spot di luar rentang wajar', s, spot); return bars }

  const nowSec = Math.floor(Date.now() / 1000)
  const currentBucket = Math.floor(nowSec / intervalSec) * intervalSec

  /* a) buang bar tak selaras bucket di ekor (artefak Yahoo tick) */
  const cleaned = bars.filter((b) => Number.isFinite(b.time) && b.time > 0 && b.time % intervalSec === 0)

  /* Kalau SEMUA bar Yahoo adalah artefak tick (tak ada satu pun
     selaras bucket — sering terjadi di 1h/2h/4h) → TETAP kirim ujung
     candle hidup: sintesis bar bucket BERJALAN dari spot. Tanpa ini
     candle 1h "diam" walau harga bergerak. */
  if (!cleaned.length) {
    console.warn('[spot-live] bar Yahoo tak selaras bucket — sintesis bar berjalan dari spot')
    return [{
      time: currentBucket,
      open: valid, high: valid, low: valid, close: valid,
    }]
  }

  const out = [...cleaned]
  const last = out[out.length - 1]

  /* sanity: spot vs close terakhir harus wajar (< 15% — anti salah-sumber) */
  if (Number.isFinite(last.close) && last.close > 0) {
    const drift = Math.abs(spot - last.close) / last.close
    if (drift > 0.15) {
      console.warn('[spot-live] drift > 15% (', last.close, '→', spot, ') — tail tanpa patch')
      return bars // data aneh → biarkan tail apa adanya
    }
  }

  /* b) isi bucket kosong (Yahoo telat buka bar baru) — CAP 60 bucket:
     kalau Yahoo telat jauh (mis. > 1 jam), isi HANYA 60 bucket
     TERAKHIR supaya ujung candle selalu sampai bucket berjalan;
     sejarah sebelum gap menyusul dari rantai utama saat refresh.
     (Guard lama "bail kalau gap > 12" bikin patch GAGAL SENYAP —
     Yahoo 5m sering telat > 1 jam → candle tetap diam.) */
  const decimals = s === 'XAUUSD' ? 2 : s === 'XAGUSD' ? 3 : 2
  const prevClose0 = Number.isFinite(last.close) && last.close > 0 ? last.close : valid
  const missing = Math.floor((currentBucket - last.time) / intervalSec)
  if (missing > 0) {
    const startT = Math.max(last.time + intervalSec, currentBucket - 59 * intervalSec)
    for (let t = startT; t <= currentBucket; t += intervalSec) {
      out.push({ time: t, open: prevClose0, high: valid, low: valid, close: valid })
    }
  }

  /* c) patch bar berjalan dgn harga spot terbaru */
  const tip = out[out.length - 1]
  if (tip && tip.time === currentBucket) {
    tip.close = Number(spot.toFixed(decimals))
    if (Number.isFinite(tip.high)) tip.high = Math.max(tip.high, tip.close)
    if (Number.isFinite(tip.low)) tip.low = Math.min(tip.low, tip.close)
  }

  return out
}

/**
 * OVERLAY TAIL UTAMA — dipanggil jalur live /api/candles?nocache.
 *   - Crypto  → tail penuh dari binance-vision (OHLC real-time)
 *   - XAU/XAG → tail dari rantai utama dipatch harga spot gold-api
 * Gagal semua → bars apa adanya (tanpa error).
 */
export async function overlaySpotTail(
  symbol: string,
  interval: string,
  bars: YahooCandle[],
  limit: number,
): Promise<{ bars: YahooCandle[]; source: string }> {
  const s = String(symbol || '').trim().toUpperCase()

  if (isCryptoLiveSymbol(s)) {
    const tail = await fetchCryptoTail(s, interval, limit)
    if (tail && tail.length) return { bars: tail, source: 'binance-spot' }
    return { bars, source: 'yahoo-finance' }
  }

  if (GOLD_API_SYMBOLS[s]) {
    const patched = await patchTailWithSpot(s, interval, bars)
    return { bars: patched, source: patched === bars ? 'yahoo-finance' : 'goldapi-spot' }
  }

  return { bars, source: 'yahoo-finance' }
}
