/**
 * ============================================================
 * spot-live.ts — OVERLAY HARGA REAL-TIME utk ujung candle (live tick)
 * ============================================================
 * MASALAH (laporan Bos: "candle ga gerak"):
 *   Jalur live /api/candles?nocache memakai rantai TradingView ->
 *   TwelveData. Di production Cloudflare Workers, websocket
 *   TradingView kadang ditolak (IP datacenter) dan TwelveData butuh
 *   key — ujung candle bisa "diam" padahal market bergerak.
 *
 * SOLUSI (ATURAN EMAS: EKOR WAJIB SE-SKALA DENGAN SEJARAH):
 *   Dulu ekor dipatch harga spot gold-api walau sejarah bisa dari
 *   Yahoo GC=F (FUTURES — beda level +- $10-40 dari spot!) -> ekor
 *   candle "melompat ke bawah" (keluhan Bos). Sekarang SEJARAH SELALU
 *   SPOT-GRADE (TradingView/TwelveData — Yahoo sudah DIHAPUS Bos:
 *   "data lain yahoo finance hapus aja") -> patch harga spot gold-api:
 *   - XAU/XAG -> gold-api (keyless, detik-an), cadangan XAUT/PAXG
 *     binance (token 1:1 emas fisik).
 *   - Crypto (BTCUSDT dll) -> data-api.binance.vision klines
 *     (OHLC penuh real-time, tanpa key).
 *
 * SEMUA keyless -> tidak menambah env baru. Gagal overlay = pakai
 * tail apa adanya (tidak pernah bikin jalur live mati).
 *
 * HANYA untuk server (API route).
 */

import type { OhlcvCandle } from './symbols'
import { validatePrice } from './symbols'

/* ---------- Interval kanonik -> detik per bar ----------
   Menerima DUA format: kanonik ('5m','1h',…) dan format Vela dari
   route /api/candles ('5','15','60','1D',… — route mempertahankan
   input mentahnya). Tanpa ini INTERVAL_SECONDS['5'] = undefined ->
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

/** Normalisasi interval (kanonik ATAU Vela) -> format kanonik. */
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

/** Format kanonik -> interval klines Binance (data-api.binance.vision) */
const BINANCE_INTERVALS: Record<string, string> = {
  '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h',
  '2h': '2h', '4h': '4h', '1d': '1d', '1w': '1w',
}
const GOLD_API_SYMBOLS: Record<string, string> = {
  XAUUSD: 'XAU',
  XAGUSD: 'XAG',
}

const CRYPTO_BINANCE_RE = /^(BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|LINK|LTC|TRX|TON|SUI|PEPE)(USDT?|USD)$/i

/* JAM BUKA PASAR SPOT GOLD/SILVER (GMT): buka Minggu 22:00 UTC,
   tutup Jumat 22:00 UTC (futures NY close 17:00 ET). Di luar window
   ini gold-api MASIH mengirim harga terakhir — kalau patch tetap
   jalan, ujung candle "bergerak" palsu & bar sintetis flat bermunculan
   saat weekend = keluhan Bos "candle kek ghost". Crypto 24/7 tanpa
   guard (binance jalan terus). */
export function goldMarketOpen(nowSec: number): boolean {
  const d = new Date(nowSec * 1000)
  const day = d.getUTCDay() // 0=Minggu … 6=Sabtu
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes()
  if (day === 6) return false // Sabtu: tutup
  if (day === 5 && mins >= 22 * 60) return false // Jumat ≥22:00: tutup
  if (day === 0 && mins < 22 * 60) return false // Minggu <22:00: tutup
  return true
}

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

/** Harga spot gold/silver — rantai 3 LAPIS, SEMUA GRATIS & KEYLESS
    (production CF Workers sering gagal ke 1 sumber, jadi rantainya
    digandakan; drift-guard di patchTail tetap melindungi skala):
    1. gold-api.com        — spot dealer (primer)
    2. XAUT/USDT binance   — Tether Gold, token 1:1 emas fisik
    3. PAXG/USDT binance   — token 1:1 emas fisik (track spot ±0.2%)
    YAHOO TICK DIHAPUS (Bos: "data lain yahoo finance hapus aja") —
    futures GC=F bisa beda level $10-40 dari spot (basis futures);
    dulu jadi lapis terakhir + drift-guard, kini rantai cukup 3 lapis
    spot murni.
    Cache sukses 10 dtk + cooldown gagal 8 dtk: polling tick 3 dtk
    dari banyak client tidak boleh nembak 3 sumber per request
    (subrequest CF Workers terbatas). */
let goldSpotCache: { price: number; at: number; src: string } | null = null
let goldSpotFailAt = 0
const GOLD_SPOT_CACHE_MS = 10_000
const GOLD_SPOT_FAIL_COOLDOWN_MS = 8_000

async function fetchGoldSpotPrice(apiSym: string): Promise<{ price: number; src: string } | null> {
  const now = Date.now()
  if (goldSpotCache && now - goldSpotCache.at < GOLD_SPOT_CACHE_MS) {
    return { price: goldSpotCache.price, src: goldSpotCache.src }
  }
  /* Cooldown gagal: semua sumber baru saja mati -> jangan nembak 3
     upstream tiap poll 3 dtk (hemat subrequest, upstream tetap ramah). */
  if (goldSpotFailAt && now - goldSpotFailAt < GOLD_SPOT_FAIL_COOLDOWN_MS) return null

  /* 1) gold-api — spot dealer */
  const direct = await fetchGoldApiPrice(apiSym)
  if (direct != null) {
    goldSpotCache = { price: direct, at: now, src: 'gold-api' }
    return { price: direct, src: 'gold-api' }
  }

  if (apiSym === 'XAU') {
    /* 2) XAUT/USDT — Tether Gold (token 1:1 emas fisik) */
    const xaut = await fetchBinancePrice('XAUTUSDT')
    if (xaut != null) {
      goldSpotCache = { price: xaut, at: now, src: 'xaut-binance' }
      return { price: xaut, src: 'xaut-binance' }
    }
    /* 3) PAXG/USDT — token 1:1 emas fisik */
    const paxg = await fetchBinancePrice('PAXGUSDT')
    if (paxg != null) {
      goldSpotCache = { price: paxg, at: now, src: 'paxg-binance' }
      return { price: paxg, src: 'paxg-binance' }
    }
  }

  goldSpotFailAt = now
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

/** Tail OHLC crypto real-time, bentuk OhlcvCandle (epoch detik). */
export async function fetchCryptoTail(
  symbol: string,
  interval: string,
  limit: number,
): Promise<OhlcvCandle[] | null> {
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
    const out: OhlcvCandle[] = rows
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
   Harga spot gold-api dipakai untuk:
   a) mempatch bar yang SEDANG BERJALAN (close/high/low), dan
   b) mengisi bucket yang masih kosong (sumber telat membuka bar baru)
   dengan bar sintetis o=h=l=c=spot — sejarah menyusul saat refresh.
   Bar dengan open-time tak selaras bucket dibuang (artefak tick). */

export async function patchTailWithSpot(
  symbol: string,
  interval: string,
  bars: OhlcvCandle[],
): Promise<OhlcvCandle[]> {
  const s = String(symbol || '').trim().toUpperCase()
  const g = GOLD_API_SYMBOLS[s]
  const intervalSec = INTERVAL_SECONDS[normInterval(interval)]
  if (!g || !intervalSec || !Array.isArray(bars) || !bars.length) {
    console.warn('[spot-live] patch skip:', s, interval, 'bars:', Array.isArray(bars) ? bars.length : 'bukan array')
    return bars
  }

  const spotRes = await fetchGoldSpotPrice(g)
  if (!spotRes) { console.warn('[spot-live] XAU/XAG spot tak tersedia (3 lapis gagal) — tail tanpa patch'); return bars }
  const spot = spotRes.price
  console.log(`[spot-live] spot ${g} dari ${spotRes.src} = ${spot}`)
  const valid = validatePrice(s, spot)
  if (valid == null) { console.warn('[spot-live] spot di luar rentang wajar', s, spot); return bars }

  const nowSec = Math.floor(Date.now() / 1000)
  const currentBucket = Math.floor(nowSec / intervalSec) * intervalSec

  /* MARKET HOURS GUARD (fix "candle kek ghost" — weekend): gold-api
     tetap mengirim harga terakhir walau pasar tutup -> patch justru
     menggerakkan ujung candle palsu + bar sintetis flat muncul.
     Pasar tutup = tail apa adanya, tanpa patch, tanpa sintesis. */
  if (!goldMarketOpen(nowSec)) {
    console.log('[spot-live] pasar spot tutup (weekend) — tail tanpa patch')
    return bars
  }

  /* a) buang bar tak selaras bucket di ekor (artefak tick) —
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

  /* Kalau SEMUA bar adalah artefak tick (tak ada satu pun layak) ->
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
     normalnya < 0.15% ($2-6). Drift lebih -> TOLAK patch: ekor
     melompat = chart rusak. */
  if (Number.isFinite(last.close) && last.close > 0) {
    const drift = Math.abs(spot - last.close) / last.close
    if (drift > 0.0035) {
      console.warn('[spot-live] drift', (drift * 100).toFixed(2) + '%', '(', last.close, '->', spot, ') — tail tanpa patch (anti lompat skala)')
      return bars // beda skala -> biarkan tail apa adanya
    }
  }

  /* b) TIP: bila bar terakhir masih segar -> WAKTU bar itu yang jadi
     tip (anchor sumber). Bila basi -> ISI GRID KOSONG di depan, tapi
     PROYEKSI IKUT GRID SUMBER (fix "kadang ilang") dan DIBATASI 2
     bucket (fix "ghost" — GHOST GUARD). */
  const decimals = s === 'XAUUSD' ? 2 : s === 'XAGUSD' ? 3 : 2
  const prevClose0 = Number.isFinite(last.close) && last.close > 0 ? last.close : valid
  let tipTime: number
  if (tipIsRecent) {
    tipTime = last.time
  } else {
    /* GHOST GUARD (fix Bos "candle kadang kek ghost"): dulu tip diproyeksi
       sampai 60 bucket ke depan — sumber telat 10-20 menit = belasan
       bar sintetis FLAT (o=h=l=c) berjejer, dan saat sumber balik segar
       bar hantu itu hilang lagi -> muncul-hilang = "ghost". Sekarang
       bridging MAKS 2 bucket (cukup utk bar berjalan); gap lebih dalam
       = JANGAN membuat tip palsu — sejarah segar dari refresh yang
       menyusul. */
    const gapBuckets = Math.max(Math.floor((nowSec - last.time) / intervalSec), 1)
    tipTime = gapBuckets <= 2 ? last.time + gapBuckets * intervalSec : last.time
  }
  const missing = Math.floor((tipTime - last.time) / intervalSec)
  if (missing > 0) {
    const startT = Math.max(last.time + intervalSec, tipTime - 1 * intervalSec)
    for (let t = startT; t <= tipTime; t += intervalSec) {
      out.push({ time: t, open: prevClose0, high: valid, low: valid, close: valid })
    }
  }

  /* c) patch bar berjalan dgn harga spot terbaru — HANYA bar berjalan
     (tipIsRecent): bar sejarah real TIDAK boleh ditimpa spot (level
     bar lampau jadi berubah = jejak hantu). */
  const tip = out[out.length - 1]
  if (tip && tipIsRecent && tip.time === tipTime) {
    tip.close = Number(spot.toFixed(decimals))
    if (Number.isFinite(tip.high)) tip.high = Math.max(tip.high, tip.close)
    if (Number.isFinite(tip.low)) tip.low = Math.min(tip.low, tip.close)
  }

  return out
}

/* ============================================================
   4) HARGA SE-SKALA CHART — utk watchlist/panel harga
   ============================================================
   ATURAN (fix laporan Bos: "chart xau putus" — akarnya watchlist
   & panel harga beda skala dengan chart):
   Semua harga yang tampil di UI WAJIB se-skala dengan chart
   /api/candles (rantai TradingView/Twelve Data spot + tail
   gold-api/binance). Fungsi ini mengembalikan harga dari SUMBER
   YANG SAMA dengan tail chart:
     - XAU/XAG  -> gold-api (rantai 3 lapis, keyless, cache 10 dtk)
     - crypto   -> binance-vision ticker (keyless)
     - lainnya  -> null (forex & indeks diambil dari candle
                  TradingView/TwelveData oleh penelepon — se-skala
                  chart)
   Sumber identik dengan overlaySpotTail -> harga mana pun di UI
   tidak akan pernah berseberangan dengan chart. */
export async function fetchChartScalePrice(
  symbol: string,
): Promise<{ price: number; source: string } | null> {
  const s = String(symbol || '').trim().toUpperCase()
  if (GOLD_API_SYMBOLS[s]) {
    const r = await fetchGoldSpotPrice(GOLD_API_SYMBOLS[s])
    return r ? { price: r.price, source: r.src } : null
  }
  if (isCryptoLiveSymbol(s)) {
    const bSym = s.replace(/USD$/i, 'USDT').replace(/USDTUSDT/i, 'USDT')
    const p = await fetchBinancePrice(bSym)
    return p ? { price: p, source: 'binance-spot' } : null
  }
  return null
}

/**
 * OVERLAY TAIL UTAMA — dipanggil jalur live /api/candles?nocache.
 * ATURAN EMAS: patch HARUS se-skala dengan sejarah (parameter `source`
 * = sumber sejarah dari fetchChain — SEMUA sumber kini spot-grade,
 * Yahoo sudah dihapus Bos):
 *   - Crypto  -> tail penuh binance-vision (real-time)
 *   - XAU/XAG -> harga spot gold-api (rantai 3 lapis)
 * Gagal semua -> bars apa adanya (tanpa error).
 */
export async function overlaySpotTail(
  symbol: string,
  interval: string,
  bars: OhlcvCandle[],
  limit: number,
  source = '',
): Promise<{ bars: OhlcvCandle[]; source: string }> {
  const s = String(symbol || '').trim().toUpperCase()

  if (isCryptoLiveSymbol(s)) {
    const tail = await fetchCryptoTail(s, interval, limit)
    if (tail && tail.length) return { bars: tail, source: 'binance-spot' }
    return { bars, source: source || 'tradingview' }
  }

  if (GOLD_API_SYMBOLS[s]) {
    /* sejarah selalu spot-grade (TradingView/TwelveData) -> patch
       spot gold-api; drift-guard di dalam patchTailWithSpot tetap
       melindungi skala (anti ekor melompat) */
    const patched = await patchTailWithSpot(s, interval, bars)
    return { bars: patched, source: patched === bars ? (source || 'tradingview') : 'goldapi-spot' }
  }

  return { bars, source: source || 'tradingview' }
}
