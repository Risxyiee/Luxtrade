/**
 * ============================================================
 * GET /api/candles — datafeed chart Vela (forex, gold, US100, crypto)
 * ============================================================
 * RANTAI SUMBER FINAL (Bos, dikonfirmasi 3× — verbatim:
 * "binaance yang dibuang"):
 *
 *   0. TRADING VIEW (websocket publik, KEYLESS) — grade broker
 *      (OANDA:XAUUSD, BINANCE:BTCUSDT utk crypto). Sudah diverifikasi
 *      hidup dari infra kita. Gagal/timeout → lanjut ke bawah.
 *
 *   1. TWELVE DATA (process.env.TWELVE_DATA_API_KEY) — candle
 *      SPOT XAU/USD, XAG/USD, forex major & NDX. Level harga
 *      paling mendekati feed broker (OANDA/MT4/MT5). Free tier
 *      8 req/min → rate limiter + cache ketat di lib twelvedata.
 *      TANPA key / quota habis / plan tak mencakup → NULL dan
 *      lanjut ke sumber di bawah (UI tidak pernah 401).
 *
 *   2. YAHOO Finance chart API (publik, GRATIS, TANPA API KEY)
 *      — fallback host otomatis query1 → query2. Selalu hidup.
 *      Crypto (BTCUSDT → BTC-USD) juga dilayani Yahoo.
 *
 * BINANCE DIBUANG (keputusan Bos). Finnhub PARKIR (butuh key,
 * bukan pilihan Bos utk rantai ini) — lib finnhub.ts dipertahankan.
 *
 * Pemetaan simbol (kanonik Luxtradee):
 *   Gold    : XAUUSD  (TD XAU/USD spot → Yahoo GC=F)
 *   Silver  : XAGUSD  (TD XAG/USD spot → Yahoo SI=F)
 *   Nasdaq  : US100   (TD NDX → Yahoo NQ=F futures; alias
 *                      NAS100/NASDAQ/NDX dinormalisasi masuk sini.
 *                      QQQ TIDAK dipakai — level ~$490 vs NDX ~21rb
 *                      merusak skala chart)
 *   Forex   : EURUSD, GBPUSD, USDJPY, dst. (TD EUR/USD → Yahoo …=X)
 *
 * Interval kanonik: 5m · 15m · 30m · 1h · 2h · 4h · 1d · 1w
 *   (2h/4h diagregasi dari 1h oleh lib bersama market/yahoo.ts)
 *
 * Konversi keluaran → OHLCV standar Vela:
 *   { time: epoch DETIK, open, high, low, close, volume? }
 *
 * Cache: in-memory (TTL per-interval) + KV Cloudflare (cross-isolate)
 *
 * KEDALAMAN HISTORY (Task — permintaan Bos, "minimal 3.000–5.000
 * historical candles ke belakang, terutama 1h/15m — BUKAN cuma 500"):
 *   - Param limit/outputsize diterima sampai 5000 bar per request.
 *   - Sumber dalam rantai menarik penuh: TradingView ws series
 *     1×request ≤5000 bar; Twelve Data outputsize ≤5000 (+pagination
 *     previous_close bila minta lebih); Yahoo period1/period2 paging
 *     (15m/30m window 60 hari, 1h sampai 730 hari) → akumulasi
 *     3–6 bulan candle tergabung KRONOLOGIS (ascending lama→baru).
 *   - Chart Vela (LuxtradeeForexProvider) meminta depth 5000 utk
 *     5m–1h → backtest Pine & scroll kiri tembus berminggu-minggu.
 *
 * Kontrak respons (sama dengan /api/forex):
 *   { success, symbol, interval, data: [{time,open,high,low,close,volume?}], source, fetchedAt }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  FOREX_SYMBOLS,
  normalizeSymbol,
  fetchYahooChart,
  type YahooCandle,
} from '@/lib/market/yahoo'
import { fetchTwelveDataCandles } from '@/lib/market/twelvedata'
import { fetchTradingViewCandles } from '@/lib/market/tradingview'
import { overlaySpotTail, hasSpotOverlay } from '@/lib/market/spot-live'
import { readStickySource, writeStickySource } from '@/lib/market/source-sticky'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* KEDALAMAN MAKSIMUM HISTORY per request (Bos: 3.000–5.000 bar,
   bukan lagi 500). Melebihi ini → klien harus memecah request. */
const MAX_LIMIT = 5000

/* Interval kanonik + format Vela ('60','240','1D',…) */
const INTERVALS: Record<string, string> = {
  '5m': '5m', '5': '5m',
  '15m': '15m', '15': '15m',
  '30m': '30m', '30': '30m',
  '1h': '1h', '60': '1h',
  '2h': '2h', '120': '2h',
  '4h': '4h', '240': '4h',
  '1d': '1d', '1D': '1d', 'D': '1d', '1440': '1d',
  '1w': '1w', '1W': '1w', 'W': '1w', '10080': '1w',
}

/* ============================================================
   CACHE in-memory + KV Cloudflare
   ============================================================ */
interface CacheEntry { data: Ohlcv[]; timestamp: number; source: string }
type Ohlcv = YahooCandle

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_DEFAULT = 5 * 60 * 1000
const CACHE_TTL_SHORT = 60 * 1000 // 5m/15m
const CACHE_TTL_PRICE = 30 * 1000

/* LIVE micro-cache — khusus polling tick 3 detik dari chart Vela
   (provider.subscribe). TTL 2.5 detik: N client polling tiap 3 detik
   digabung jadi ±1 fetch upstream per 2.5s per (symbol,interval) —
   sumber (TradingView WS/TwelveData/Yahoo) tidak banjir request. */
const liveCache = new Map<string, CacheEntry>()
const LIVE_TTL = 2500

function getLiveCached(key: string): CacheEntry | null {
  const entry = liveCache.get(key)
  if (entry && Date.now() - entry.timestamp < LIVE_TTL) return entry
  liveCache.delete(key)
  return null
}

function getCacheTtl(interval: string, limit: number): number {
  if (limit <= 1) return CACHE_TTL_PRICE
  if (interval === '5m' || interval === '15m') return CACHE_TTL_SHORT
  return CACHE_TTL_DEFAULT
}

function getCached(key: string, interval: string, limit: number): CacheEntry | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < getCacheTtl(interval, limit)) return entry
  cache.delete(key)
  return null
}

function setCache(key: string, data: Ohlcv[], source: string) {
  cache.set(key, { data, timestamp: Date.now(), source })
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

/* VERSI CACHE KV — RESET (permintaan Bos: "reset cache siapa tau
   masih cache lama"; juga membuang entri campuran skala lama
   GC=F-vs-spot penyebab ekor melompat). Naikkan versi ini setiap
   ingin membuang SEMUA entri lama sekaligus: kunci lama jadi yatim
   & kedaluwarsa sendiri (TTL ≤ 300s), tanpa flush manual Cloudflare.
   v4 → agregasi 2h/4h kini bucket-aligned (buang entri lama yg
   batas group-nya geser — penyebab candle 2h/4h melompat).
   v5 → rantai spot 4 lapis + proyeksi grid sumber (tail patch) —
   buang entri KV lama yg ekornya tak ter-patch/campur skala.
   v6 → METALS SCALE-LOCK (logam Yahoo GC=F/SI=F di semua TF &
   pull) — buang entri KV lama yg masih campur skala spot↔futures
   (penyebab "chart gajelas antar TF" & "Entry/SL/TP ga muncul"). */
const KV_CACHE_VER = 'v6'

async function getKvCache(key: string): Promise<CacheEntry | null> {
  try {
    let kv: any = null
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = getCloudflareContext()
      kv = (ctx as any)?.env?.luxtradee_kv
    } catch {}
    if (!kv) return null
    const raw = await kv.get(`candles:${KV_CACHE_VER}:${key}`, 'text')
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

async function setKvCache(key: string, data: Ohlcv[], source: string, ttlSeconds: number): Promise<void> {
  try {
    let kv: any = null
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = getCloudflareContext()
      kv = (ctx as any)?.env?.luxtradee_kv
    } catch {}
    if (!kv) return
    const entry: CacheEntry = { data, timestamp: Date.now(), source }
    await kv.put(`candles:${KV_CACHE_VER}:${key}`, JSON.stringify(entry), { expirationTtl: ttlSeconds })
  } catch {
    // KV tidak tersedia — skip
  }
}

/* ============================================================
   RANTAI SUMBER BERSAMA — TradingView → TwelveData → Yahoo
   Dipakai jalur normal & jalur live (polling tick).

   STICKY SOURCE (lib bersama source-sticky.ts, dipakai juga oleh
   server-candles utk backtest Pine): sumber yang terakhir SUKSES
   untuk (symbol,interval) diingat 15 menit dan DICOBA DULU di
   request berikutnya — chart konsisten satu skala harga (anti
   lompat spot↔futures antar request); failover tetap jalan bila
   sumber sticky benar-benar mati.
   ============================================================ */
const SOURCE_FETCHERS: Record<string, (s: string, i: string, l: number) => Promise<Ohlcv[] | null>> = {
  tradingview: (s, i, l) => fetchTradingViewCandles(s, i, l),
  twelvedata: (s, i, l) => fetchTwelveDataCandles(s, i, l),
  'yahoo-finance': (s, i, l) => fetchYahooChart(s, i, l, l <= 1),
}
const SOURCE_ORDER = ['tradingview', 'twelvedata', 'yahoo-finance']

/* ============================================================
   METALS SCALE-LOCK (fix "chart masih gajelas antar TF beda-beda"
   + "pine ga ada Entry/SL/TP") — DIAGNOSIS PRODUKSI 2026:
   TradingView sering DITOLAK dari IP Cloudflare Workers, tapi
   KADANG berhasil → satu TF dapat OANDA spot ($4035) sementara TF
   lain / pull compile-pine dapat Yahoo GC=F futures ($4048) —
   beda skala ±$13 dan beda anchor bucket (4h TV mulai 01:00 UTC,
   Yahoo 00:00). Akibatnya: harga antar TF beda-beda, dan plot
   Entry/SL/TP Pine (dihitung server dari pull TERPISAH) gagal
   match waktu bar chart → semua null → garis TIDAK PERNAH muncul.
   SOLUSI: logam (XAUUSD/XAGUSD) DIKUNCI ke SATU skala — Yahoo
   GC=F/SI=F — di SEMUA pull (chart & Pine runner & tail), tanpa
   sticky: deterministik, gratis, keyless, deep 5000 bar, dan
   overlay tail otomatis pakai tick Yahoo se-skala (patchTailYahoo
   Live). TradingView/TwelveData hanya fallback bila Yahoo mati.
   ============================================================ */
const METALS_SCALE_LOCK = new Set(['XAUUSD', 'XAGUSD'])
const SOURCE_ORDER_METALS = ['yahoo-finance', 'tradingview', 'twelvedata']

async function fetchChain(
  symbol: string,
  interval: string,
  limit: number,
): Promise<{ bars: Ohlcv[]; source: string } | null> {
  const stickyKey = `${symbol}:${interval}`
  const isMetal = METALS_SCALE_LOCK.has(symbol)

  /* METALS SCALE-LOCK: tanpa sticky — urutan tetap Yahoo dulu di
     SEMUA isolate & TF, jadi skala kagak bisa campur lagi. */
  let sticky: string | null = null
  if (!isMetal) {
    /* 0) STICKY — sumber sukses terakhir dicoba DULU (anti ganti-ganti
          skala antar request) */
    sticky = await readStickySource(stickyKey)
    if (sticky && SOURCE_FETCHERS[sticky]) {
      try {
        const bars = await SOURCE_FETCHERS[sticky](symbol, interval, limit)
        if (bars && bars.length) {
          void writeStickySource(stickyKey, sticky)
          return { bars, source: sticky }
        }
      } catch { /* sticky gagal → jatuh ke urutan kanonik */ }
    }
  }

  /* 1..3) URUTAN: metals → Yahoo (GC=F/SI=F) → TradingView → TwelveData;
     non-metals → TradingView → TwelveData → Yahoo */
  const order = isMetal ? SOURCE_ORDER_METALS : SOURCE_ORDER
  for (const source of order) {
    if (source === sticky) continue // sudah dicoba di atas (non-metals)
    try {
      const bars = await SOURCE_FETCHERS[source](symbol, interval, limit)
      if (bars && bars.length) {
        if (!isMetal) void writeStickySource(stickyKey, source)
        return { bars, source }
      }
    } catch { /* lanjut sumber berikutnya */ }
  }

  return null
}

/* ============================================================
   MAIN HANDLER
   ============================================================ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSymbol = searchParams.get('symbol') || 'XAUUSD'
    const rawInterval = searchParams.get('interval') || searchParams.get('timeframe') || '1h'
    /* KEDALAMAN: default 300 (kompatibel pemanggil lama), tapi klien
       boleh minta sampai 5000 bar — chart Vela meminta depth penuh. */
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || searchParams.get('outputsize') || '300') || 300, 1),
      MAX_LIMIT,
    )
    const nocache = searchParams.get('nocache') === 'true'

    const symbol = normalizeSymbol(rawSymbol)
    /* NORMALISASI KE KANONIK (fix akar "chart kek setan"): dulu nilai
       RAW Vela ('5','60','240','1D',…) diteruskan apa adanya ke
       fetchChain → YAHOO_INTERVALS['240'] dsb. TIDAK ADA → diam-diam
       fallback '1h' → chart 4h/5m/2h menampilkan DATA 1H dengan
       bucket waktu tak selaras; poll live (bucket 4h/5m ASLI) tak
       pernah cocok → candle melompat/ilang/kebawah. Sekarang satu
       kali di sini: '240'→'4h', '5'→'5m', dst. — SEMUA lapisan
       (sumber, cache, overlay spot, backtest Pine) memakai kanonik. */
    const interval = INTERVALS[rawInterval] || '1h'

    if (!FOREX_SYMBOLS[symbol]) {
      console.warn(`[Candles] Simbol tidak didukung: "${rawSymbol}" → "${symbol}"`)
      return NextResponse.json({
        success: false,
        symbol,
        interval,
        data: [],
        source: 'unsupported',
        unavailable: true,
        message: `Simbol "${rawSymbol}" tidak didukung di /api/candles. Tersedia: ${Object.keys(FOREX_SYMBOLS).join(', ')}.`,
        fetchedAt: new Date().toISOString(),
      }, { status: 400 })
    }
    const validSymbol = symbol
    const cacheKey = `${validSymbol}:${interval}:${limit}`
    const kvTtlSeconds = limit <= 1 ? 30 : (interval === '5m' || interval === '15m') ? 60 : 300

    /* ---- JALUR LIVE (polling tick 3 detik, tail saja) ----
       nocache + limit kecil = poll candle terakhir dari provider Vela.
       Pakai micro-cache 2.5s agar banyak client berbagi satu fetch
       upstream; jawaban TANPA cache HTTP (no-store) supaya ujung
       candle bergerak mulus layaknya feed broker.
       FIX "CANDLE GA GERAK" (produksi): TradingView sering ditolak
       dari IP Workers & TwelveData butuh key → sisa Yahoo telat
       10–20 menit → ujung candle diam. Overlay SPOT keyless real-time
       (gold-api utk XAU/XAG, binance-vision utk crypto) mengoreksi
       ujung candle SEBELUM dikirim ke chart. */
    if (nocache && limit <= 3) {
      const liveKey = `${validSymbol}:${interval}`
      const hit = getLiveCached(liveKey)
      if (hit) {
        return NextResponse.json({
          success: true, symbol: validSymbol, interval,
          data: hit.data.slice(-limit), source: hit.source + '-live',
          fetchedAt: new Date(hit.timestamp).toISOString(), stale: false,
        }, { headers: { 'Cache-Control': 'no-store' } })
      }
      const tail = await fetchChain(validSymbol, interval, Math.max(limit, 3))
      if (tail && tail.bars.length) {
        /* Overlay spot real-time SE-SKALA DENGAN SUMBER SEJARAH (fix
           "candle kebawah"): TradingView/TwelveData → gold-api spot;
           Yahoo (futures) → tick Yahoo sendiri; crypto → binance-vision. */
        const overlayWanted = hasSpotOverlay(validSymbol)
        let liveBars = tail.bars
        let liveSource = tail.source
        if (overlayWanted) {
          try {
            const patched = await overlaySpotTail(validSymbol, interval, tail.bars, Math.max(limit, 3), tail.source)
            if (patched?.bars?.length) { liveBars = patched.bars; liveSource = patched.source }
          } catch { /* overlay gagal → tail apa adanya */ }
        }
        liveCache.set(liveKey, { data: liveBars, timestamp: Date.now(), source: liveSource })
        if (liveCache.size > 300) {
          const oldest = [...liveCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
          if (oldest) liveCache.delete(oldest[0])
        }
        /* segarkan juga cache utama — HANYA bila chain benar-benar
           mengembalikan sejarah dalam (≥300 bar): jangan pernah
           menimpa cache :300 dengan tail 3-bar / isian sintetis. */
        if (tail.bars.length >= 300) setCache(`${validSymbol}:${interval}:300`, liveBars, liveSource)
        return NextResponse.json({
          success: true, symbol: validSymbol, interval,
          data: liveBars.slice(-limit), source: liveSource,
          fetchedAt: new Date().toISOString(),
        }, { headers: { 'Cache-Control': 'no-store' } })
      }
      /* semua sumber gagal → jatuh ke cache utama (stale pun lebih baik
         dari kosong untuk ujung candle; chart tetap jalan) */
      const staleHit = cache.get(`${validSymbol}:${interval}:300`) || cache.get(cacheKey)
      if (staleHit) {
        return NextResponse.json({
          success: true, symbol: validSymbol, interval,
          data: staleHit.data.slice(-limit), source: staleHit.source + '-stale',
          fetchedAt: new Date(staleHit.timestamp).toISOString(), stale: true,
        }, { headers: { 'Cache-Control': 'no-store' } })
      }
      return NextResponse.json({
        success: false, symbol: validSymbol, interval, data: [],
        source: 'unavailable', unavailable: true,
        message: `Data live ${validSymbol} sedang tidak dapat diakses.`,
        fetchedAt: new Date().toISOString(),
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }

    /* ---- Cache in-memory ---- */
    if (!nocache) {
      const cached = getCached(cacheKey, interval, limit)
      if (cached) {
        const age = Date.now() - cached.timestamp
        if (!(limit <= 1 && age > 15000)) {
          return NextResponse.json({
            success: true, symbol: validSymbol, interval,
            data: cached.data, source: cached.source + '-memcache',
            fetchedAt: new Date(cached.timestamp).toISOString(), stale: false,
          })
        }
        cache.delete(cacheKey) // price check butuh segar
      }
      /* ---- Cache KV (cross-isolate CF Workers) ---- */
      const kvCached = await getKvCache(cacheKey)
      if (kvCached && Date.now() - kvCached.timestamp < getCacheTtl(interval, limit)) {
        const kvAge = Date.now() - kvCached.timestamp
        if (!(limit <= 1 && kvAge > 15000)) {
          setCache(cacheKey, kvCached.data, kvCached.source)
          return NextResponse.json({
            success: true, symbol: validSymbol, interval,
            data: kvCached.data, source: kvCached.source + '-kvcache',
            fetchedAt: new Date(kvCached.timestamp).toISOString(), stale: false,
          })
        }
      }
    }

    /* ---- RANTAI SUMBER: TradingView → TwelveData → Yahoo ----
       (urutan FINAL Bos — "binaance yang dibuang"; limit<=1 →
       Yahoo liveTick aktif sbg harga real-time) */
    const chain = await fetchChain(validSymbol, interval, limit)
    if (chain) {
      setCache(cacheKey, chain.bars, chain.source)
      await setKvCache(cacheKey, chain.bars, chain.source, kvTtlSeconds)
      console.log(`[Candles] ✓ ${chain.bars.length} candles ${chain.source} (${validSymbol} ${interval})`)
      return NextResponse.json({
        success: true, symbol: validSymbol, interval, data: chain.bars,
        source: chain.source,
        fetchedAt: new Date().toISOString(),
      })
    }

    /* ---- SEMUA SUMBER GAGAL — respons jujur (TANPA mock) ---- */
    console.error(`[Candles] ❌ semua sumber gagal utk ${validSymbol} ${interval}`)
    return NextResponse.json({
      success: false,
      symbol: validSymbol,
      interval,
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: `Data live untuk ${validSymbol} sedang tidak dapat diakses. Coba beberapa menit lagi.`,
      fetchedAt: new Date().toISOString(),
    }, { status: 503 })
  } catch (error) {
    console.error('[Candles] ❌ Unhandled error:', error)
    return NextResponse.json({
      success: false,
      symbol: new URL(request.url).searchParams.get('symbol') || 'XAUUSD',
      interval: new URL(request.url).searchParams.get('interval') || '1h',
      data: [],
      source: 'unavailable',
      unavailable: true,
      message: 'Data live sedang tidak dapat diakses. Terjadi kesalahan internal.',
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString(),
    }, { status: 503 })
  }
}
