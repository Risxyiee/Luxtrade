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
 * SOLUSI (REVISI — ATURAN EMAS: EKOR WAJIB SE-SKALA DENGAN SEJARAH):
 *   Dulu ekor dipatch harga spot gold-api walau sejarah bisa dari
 *   Yahoo GC=F (FUTURES — beda level ±$10-40 dari spot!) → ekor
 *   candle "melompat ke bawah" (keluhan Bos) dan chart pindah-pindah
 *   level saat sumber rantai bergantian ("kek setan"). Sekarang patch
 *   mengikuti SKALA SUMBER SEJARAH:
 *   - Sejarah SPOT-GRADE (TradingView OANDA / TwelveData) → patch
 *     harga spot gold-api (XAU/XAG, keyless, detik-an).
 *   - Sejarah YAHOO (GC=F/SI=F futures) → patch dengan TICK YAHOO
 *     SENDIRI (meta.regularMarketPrice — level PASTI sama dgn
 *     sejarahnya, update nyaris real-time saat bursa buka).
 *   - Crypto (BTCUSDT dll) → data-api.binance.vision klines
 *     (OHLC penuh real-time, tanpa key).
 *
 * SEMUA keyless → tidak menambah env baru. Gagal overlay = pakai
 * tail apa adanya (tidak pernah bikin jalur live mati) — dan patch
 * yang lintas-skala (drift > guard) DITOLAK, bukan dipaksakan.
 *
 * HANYA untuk server (API route).
 */

import type { YahooCandle } from './yahoo'
import { validatePrice, fetchYahooQuoteTick } from './yahoo'

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

/* Sumber sejarah ber-SKALA SPOT (level = harga dealer/spot): patch boleh
   pakai harga spot gold-api. Sumber lain (yahoo = futures GC=F/SI=F)
   HARUS dipatch tick dari sumbernya sendiri — bukan spot. */
const SPOT_GRADE_SOURCES = new Set(['tradingview', 'twelvedata'])

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

/** Harga spot gold/silver dengan fallback 2 LAPIS — KEDUANYA
    SPOT-LEVEL (tidak ada lagi fallback futures yang skala-nya beda):
    1. gold-api.com (primer — spot grade dealer)
    2. PAXG/USDT binance-vision (token 1:1 emas fisik, track spot ±0.2%)
    Yahoo futures SENGAJA DIBUANG dari rantai spot: GC=F beda level
    $10-40 dari spot (basis futures) → mem-patch sejarah spot dgn
    futures = ekor candle melompat (bug "candle kebawah" Bos).
    Cache sukses 10 dtk: polling tick 3 dtk dari banyak client tidak
    boleh nembak 2 sumber per request (subrequest CF Workers terbatas). */
let goldSpotCache: { price: number; at: number; src: string } | null = null
const GOLD_SPOT_CACHE_MS = 10_000

async function fetchGoldSpotPrice(apiSym: string): Promise<{ price: number; src: string } | null> {
  const now = Date.now()
  if (goldSpotCache && now - goldSpotCache.at < GOLD_SPOT_CACHE_MS) {
    return { price: goldSpotCache.price, src: goldSpotCache.src }
  }
  const direct = await fetchGoldApiPrice(apiSym)
  if (direct != null) {
    goldSpotCache = { price: direct, at: now, src: 'gold-api' }
    return { price: direct, src: 'gold-api' }
  }
  if (apiSym === 'XAU') {
    const paxg = await fetchBinancePrice('PAXGUSDT')
    if (paxg != null) {
      goldSpotCache = { price: paxg, at: now, src: 'paxg-binance' }
      return { price: paxg, src: 'paxg-binance' }
    }
  }
  return null
}

/** Harga spot real-time (null bila simbol tanpa overlay / sumber gagal) */
export async function fetchSpotPrice(symbol: string): Promise<number | null> {
  const s = String(symbol || '').trim().toUpperCase()
  const g = GOLD_API_SYMBOLS[s]
  if (g) {
    const r = await fetchGoldSpotPrice(g)
    return r?.price ?? null
  }
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

  const spotRes = await fetchGoldSpotPrice(g)
  if (!spotRes) { console.warn('[spot-live] XAU/XAG spot tak tersedia (gold-api & PAXG gagal) — tail tanpa patch'); return bars }
  const spot = spotRes.price
  console.log(`[spot-live] spot ${g} dari ${spotRes.src} = ${spot}`)
  const valid = validatePrice(s, spot)
  if (valid == null) { console.warn('[spot-live] spot di luar rentang wajar', s, spot); return bars }

  const nowSec = Math.floor(Date.now() / 1000)
  const currentBucket = Math.floor(nowSec / intervalSec) * intervalSec

  /* a) buang bar tak selaras bucket di ekor (artefak Yahoo tick) —
     KECUALI bar terakhir yang masih berada dalam window bucket
     BERJALAN: sumber seperti TradingView punya ANCHOR bucket sendiri
     (4h-nya mulai 01:00 UTC, bukan 00:00) — bar itu sah sebagai candle
     berjalan; memaksakan anchor UTC justru menciptakan candle kembar
     ("kadang ilang"). KONVENSI TIP MENGIKUTI SUMBER. */
  const windowStart = nowSec - intervalSec
  const rawLast = bars[bars.length - 1]
  const tipIsRecent = Number.isFinite(rawLast?.time) &&
    rawLast.time > windowStart && rawLast.time <= nowSec + 60
  const cleaned = bars.filter((b, idx) =>
    Number.isFinite(b.time) && b.time > 0 &&
    (b.time % intervalSec === 0 || (idx === bars.length - 1 && tipIsRecent)),
  )

  /* Kalau SEMUA bar adalah artefak tick (tak ada satu pun layak) →
     TETAP kirim ujung candle hidup: sintesis bar bucket BERJALAN
     dari spot. Tanpa ini candle "diam" walau harga bergerak. */
  if (!cleaned.length) {
    console.warn('[spot-live] bar sumber tak layak — sintesis bar berjalan dari spot')
    return [{
      time: currentBucket,
      open: valid, high: valid, low: valid, close: valid,
    }]
  }

  const out = [...cleaned]
  const last = out[out.length - 1]

  /* sanity KETAT: spot vs close terakhir — XAU/XAG beda sumber spot
     normalnya < 0.15% ($2-6). Drift lebih (mis. mencampur futures
     GC=F dgn spot) → TOLAK patch: ekor melompat = chart rusak. */
  if (Number.isFinite(last.close) && last.close > 0) {
    const drift = Math.abs(spot - last.close) / last.close
    if (drift > 0.0035) {
      console.warn('[spot-live] drift', (drift * 100).toFixed(2) + '%', '(', last.close, '→', spot, ') — tail tanpa patch (anti lompat skala)')
      return bars // beda skala → biarkan tail apa adanya
    }
  }

  /* b) TIP: bila bar terakhir masih segar → WAKTU bar itu yang jadi
     tip (anchor sumber). Bila basi → isi bucket kosong sampai bucket
     berjalan (CAP 60 — Yahoo telat jauh tetap sampai ujung). */
  const decimals = s === 'XAUUSD' ? 2 : s === 'XAGUSD' ? 3 : 2
  const prevClose0 = Number.isFinite(last.close) && last.close > 0 ? last.close : valid
  const tipTime = tipIsRecent ? last.time : currentBucket
  const missing = Math.floor((tipTime - last.time) / intervalSec)
  if (missing > 0) {
    const startT = Math.max(last.time + intervalSec, tipTime - 59 * intervalSec)
    for (let t = startT; t <= tipTime; t += intervalSec) {
      out.push({ time: t, open: prevClose0, high: valid, low: valid, close: valid })
    }
  }

  /* c) patch bar berjalan dgn harga spot terbaru */
  const tip = out[out.length - 1]
  if (tip && tip.time === tipTime) {
    tip.close = Number(spot.toFixed(decimals))
    if (Number.isFinite(tip.high)) tip.high = Math.max(tip.high, tip.close)
    if (Number.isFinite(tip.low)) tip.low = Math.min(tip.low, tip.close)
  }

  return out
}

/* ============================================================
   4) PATCH TAIL YAHOO — tick dari SUMBER YAHOO SENDIRI
   ============================================================
   Sejarah dari Yahoo (GC=F/SI=F futures) TIDAK BOLEH dipatch harga
   spot (beda basis $10-40 → ekor melompat). Sebagai gantinya ekor
   dipatch regularMarketPrice Yahoo — level PASTI se-skala dgn
   sejarahnya dan bergerak nyaris real-time saat bursa buka.
   Dipakai juga sebagai penyelamat "candle ga gerak" ketika gold-api
   tidak tersedia dari egress Cloudflare. */

/** Tick Yahoo harus cukup segar: bursa tutup (weekend/holiday) →
    regularMarketTime diam → JANGAN sintesis (biar tidak pindah level). */
const YAHOO_TICK_MAX_AGE_SEC = 15 * 60

export async function patchTailYahooLive(
  symbol: string,
  interval: string,
  bars: YahooCandle[],
): Promise<YahooCandle[]> {
  const s = String(symbol || '').trim().toUpperCase()
  const intervalSec = INTERVAL_SECONDS[normInterval(interval)]
  if (!intervalSec || !Array.isArray(bars) || !bars.length) return bars

  const tick = await fetchYahooQuoteTick(s)
  if (!tick) { console.warn('[spot-live] yahoo-tick gagal diambil — tail tanpa patch'); return bars }
  if (tick.time < Date.now() / 1000 - YAHOO_TICK_MAX_AGE_SEC) { console.warn('[spot-live] yahoo-tick basi (', Math.floor(Date.now() / 1000 - tick.time), 's ) — tail tanpa patch'); return bars } // market tutup
  const valid = validatePrice(s, tick.price)
  if (valid == null) { console.warn('[spot-live] yahoo-tick di luar rentang wajar:', tick.price); return bars }

  const nowSec = Math.floor(Date.now() / 1000)
  const currentBucket = Math.floor(nowSec / intervalSec) * intervalSec

  /* buang bar tak selaras bucket di ekor (artefak tick) — bar terakhir
     yang masih dalam window berjalan TETAP disimpan (anchor sumber) */
  const windowStart = nowSec - intervalSec
  const rawLast = bars[bars.length - 1]
  const tipIsRecent = Number.isFinite(rawLast?.time) &&
    rawLast.time > windowStart && rawLast.time <= nowSec + 60
  const cleaned = bars.filter((b, idx) =>
    Number.isFinite(b.time) && b.time > 0 &&
    (b.time % intervalSec === 0 || (idx === bars.length - 1 && tipIsRecent)),
  )
  if (!cleaned.length) {
    return [{ time: currentBucket, open: valid, high: valid, low: valid, close: valid }]
  }

  const out = [...cleaned]
  const last = out[out.length - 1]

  /* sanity: tick Yahoo vs close sejarah Yahoo — sama sumber, normalnya
     < 0.5% (gap antar-sesi). Lebih → aneh, jangan patch. */
  if (Number.isFinite(last.close) && last.close > 0) {
    const drift = Math.abs(valid - last.close) / last.close
    if (drift > 0.02) {
      console.warn('[spot-live] yahoo-tick drift', (drift * 100).toFixed(2) + '%', '— tail tanpa patch')
      return bars
    }
  }

  const decimals = s === 'XAUUSD' ? 2 : s === 'XAGUSD' ? 3 : 2
  const prevClose0 = Number.isFinite(last.close) && last.close > 0 ? last.close : valid
  const tipTime = tipIsRecent ? last.time : currentBucket
  const missing = Math.floor((tipTime - last.time) / intervalSec)
  if (missing > 0) {
    const startT = Math.max(last.time + intervalSec, tipTime - 59 * intervalSec)
    for (let t = startT; t <= tipTime; t += intervalSec) {
      out.push({ time: t, open: prevClose0, high: valid, low: valid, close: valid })
    }
  }

  const tip = out[out.length - 1]
  if (tip && tip.time === tipTime) {
    tip.close = Number(valid.toFixed(decimals))
    if (Number.isFinite(tip.high)) tip.high = Math.max(tip.high, tip.close)
    if (Number.isFinite(tip.low)) tip.low = Math.min(tip.low, tip.close)
  }
  return out
}

/**
 * OVERLAY TAIL UTAMA — dipanggil jalur live /api/candles?nocache.
 * ATURAN EMAS: patch HARUS se-skala dengan sejarah (parameter `source`
 * = sumber sejarah dari fetchChain):
 *   - Crypto                     → tail penuh binance-vision (real-time)
 *   - XAU/XAG, sumber spot-grade → harga spot gold-api
 *   - XAU/XAG, sumber lain (Yahoo futures) → tick Yahoo sendiri
 * Gagal semua → bars apa adanya (tanpa error).
 */
export async function overlaySpotTail(
  symbol: string,
  interval: string,
  bars: YahooCandle[],
  limit: number,
  source = '',
): Promise<{ bars: YahooCandle[]; source: string }> {
  const s = String(symbol || '').trim().toUpperCase()

  if (isCryptoLiveSymbol(s)) {
    const tail = await fetchCryptoTail(s, interval, limit)
    if (tail && tail.length) return { bars: tail, source: 'binance-spot' }
    return { bars, source: source || 'yahoo-finance' }
  }

  if (GOLD_API_SYMBOLS[s]) {
    if (SPOT_GRADE_SOURCES.has(String(source || '').toLowerCase())) {
      /* sejarah spot-grade (TradingView/TwelveData) → patch spot gold-api */
      const patched = await patchTailWithSpot(s, interval, bars)
      return { bars: patched, source: patched === bars ? (source || 'tradingview') : 'goldapi-spot' }
    }
    /* sejarah Yahoo (futures) / sumber tak dikenal → tick Yahoo sendiri
       (se-skala — anti ekor melompat) */
    console.log('[spot-live] overlay yahoo-branch:', s, interval, 'src=', source, 'bars=', bars.length)
    const patched = await patchTailYahooLive(s, interval, bars)
    return { bars: patched, source: source || 'yahoo-finance' }
  }

  return { bars, source: source || 'yahoo-finance' }
}
