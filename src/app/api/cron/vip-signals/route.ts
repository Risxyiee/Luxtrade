import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import { getSelfFetch } from '@/lib/cloudflare-bindings'
import { isXauMarketOpen } from '@/lib/market-hours'
import {
  evaluateCloses,
  broadcastVipSignal,
  getMarketListenerStatus,
  type PriceTick,
  type SignalPayload,
} from '@/services/marketListener'

/**
 * GET/POST /api/cron/vip-signals
 * ============================================================
 * Real-time Alert Engine — JALUR PRODUKSI (Cloudflare Workers).
 *
 * `ws` (WebSocket Node) tidak jalan di runtime Workers (terbukti
 * commit e4c7abc5), jadi tick-by-tick diganti polling harga tiap
 * 15 menit yang MENUMPANG slot cron 15-menitan yang sudah ada (CF Free
 * maks 5 cron trigger — slot tidak boleh nambah; lihat
 * worker-entry.ts). Harganya diambil dari /api/candles (SELF
 * binding anti-522, pola price-alerts): 80 candle 15m (±20 jam) →
 * closes → otak indikator yang SAMA dengan jalur WS: evaluateCloses()
 * di src/services/marketListener.ts (EMA9/21 cross + filter RSI14 —
 * stateless, cocok untuk isolate Workers yang selalu baru).
 *
 * Sinyal valid → Web Push ke seluruh user PRO (Arah/Entry/SL/TP)
 * + log ke tabel market_alerts — semuanya di broadcastVipSignal().
 *
 * MODE TES (butuh auth cron):
 *   ?demo=1  → paksa 1 sinyal contoh BUY dari harga terakhir
 *              (judul diawali [TES]) melalui pipeline ASLI —
 *              buat verifikasi push sampai layar HP Bos tanpa
 *              menunggu indikator pribadi diisi.
 *
 * Auth: Bearer PINE_ALERT_CRON_SECRET / CRON_SECRET
 * (fail-closed di produksi, pola price-alerts).
 * ============================================================
 */
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
const SYMBOL = 'XAUUSD' // kanonik Luxtradee → XAU/USD di upstream

// Lock in-memory anti dobel-jalan (pola price-alerts)
let running = false
let lastRunAt = 0

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided = String(
    request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('x-cron-secret') ||
      ''
  ).trim()
  const validSecrets = [
    String(process.env.PINE_ALERT_CRON_SECRET || '').trim(),
    String(process.env.CRON_SECRET || '').trim(),
  ].filter(Boolean)
  if (!validSecrets.length) {
    return process.env.NODE_ENV === 'development'
  }
  if (provided && validSecrets.includes(provided)) return true
  return process.env.NODE_ENV === 'development'
}

/** Candle 15m XAU/USD — via /api/candles (SELF binding anti-522).
 *  80 bar (±20 jam) cukup utk EMA21 + RSI14 + deteksi cross.
 *  Bar terakhir DIBUANG dari `closes`: itu bar BERJALAN (overlay spot
 *  real-time di /api/candles) — saat pasar tutup nilai overlay-nya
 *  berganti-ganti antar sumber/cache → EMA9×21 "cross palsu" dari noise
 *  (bug spam Minggu 2026-11-08: BUY 10:00 WIB → SELL 10:30 WIB padahal
 *  pasar TUTUP). Keputusan sinyal = bar tutup SAJA. */
const CANDLE_INTERVAL = '15m'
const CANDLE_LIMIT = 80
const CANDLE_INTERVAL_MIN = Number(CANDLE_INTERVAL.replace(/\D/g, '')) || 15
/** Bar tertutup terakhir harus segar ≤ 3× timeframe (45 mnt utk 15m).
 *  Lebih tua = pasar tutup/weekend/data beku → JANGAN evaluasi. */
const STALE_CLOSED_BAR_SEC = 3 * CANDLE_INTERVAL_MIN * 60

async function fetchCandles(): Promise<{
  price: number
  symbol: string
  closes: number[]
  /** epoch DETIK pembukaan bar tertutup terakhir; 0 bila upstream tak menyediakan */
  lastClosedAtSec: number
} | null> {
  try {
    const quoteUrl =
      `${SITE_URL}/api/candles?symbol=${encodeURIComponent(SYMBOL)}` +
      `&interval=${CANDLE_INTERVAL}&limit=${CANDLE_LIMIT}`
    const selfFetch = await getSelfFetch()
    const res = selfFetch
      ? await selfFetch(quoteUrl, { signal: AbortSignal.timeout(12_000) })
      : await fetch(quoteUrl, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const json = await res.json()
    const bars = Array.isArray(json?.data) ? json.data : []
    if (!bars.length) return null
    const closed = bars.length > 1 ? bars.slice(0, -1) : bars
    const closes: number[] = []
    for (const b of closed) {
      const c = Number(b?.close)
      if (Number.isFinite(c) && c > 0) closes.push(c)
    }
    const last = bars[bars.length - 1]
    const price = Number(last?.close)
    if (!closes.length || !Number.isFinite(price) || price <= 0) return null
    const lastClosedTime = Number(closed[closed.length - 1]?.time)
    return {
      price,
      symbol: String(last?.symbol || 'XAU/USD'),
      closes,
      lastClosedAtSec:
        Number.isFinite(lastClosedTime) && lastClosedTime > 0 ? lastClosedTime : 0,
    }
  } catch {
    return null
  }
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  if (running && Date.now() - lastRunAt < 10 * 60_000) {
    return NextResponse.json({ skipped: 'run sebelumnya masih jalan' })
  }
  running = true
  lastRunAt = Date.now()

  try {
    const demo = request.nextUrl.searchParams.get('demo') === '1'

    /* ── GERBANG KALENDER PASAR (keluhan Bos 8 Nov 2026, Minggu) ──
       Gerbang "bar basi" di bawah hanya melindungi bila upstream
       menyediakan timestamp bar (lastClosedAtSec > 0); kalau tidak,
       evaluasi jalan atas data beku weekend → EMA cross palsu →
       alert pasaran tutap. Gerbang kalender tak bisa dibodohi:
       XAU tutup Jumat 17:00 ET s.d. Minggu 18:00 ET (+ jeda harian
       17:00–17:59 ET Senin–Kamis). Dipasang SEBELUM fetch candle →
       hemat kuota upstream juga. */
    if (!demo && !isXauMarketOpen()) {
      return NextResponse.json({
        ok: true,
        triggered: false,
        skipped: 'market-closed-calendar',
        symbol: 'XAU/USD',
        engine: getMarketListenerStatus(),
        elapsed_ms: Date.now() - startTime,
      })
    }

    const quote = await fetchCandles()
    if (!quote) {
      return NextResponse.json(
        { ok: false, error: 'candle XAU/USD tidak tersedia (upstream gagal) — coba lagi nanti' },
        { status: 502 }
      )
    }

    const tick: PriceTick = {
      symbol: 'XAU/USD',
      price: quote.price,
      timestamp: Date.now(),
      source: demo ? 'demo' : 'poll',
    }

    // ── GERBANG PASAR TUTUP (anti sinyal basi) ──
    // Bar tertutup terakhir harus segar (≤ 45 mnt utk TF 15m). Weekend
    // / holiday → candle beku → jangan evaluasi: cross basi yang sama
    // tidak boleh menembak ulang tiap lewatnya window re-arm.
    const nowSec = Math.floor(Date.now() / 1000)
    const barAgeSec = quote.lastClosedAtSec > 0 ? nowSec - quote.lastClosedAtSec : 0
    if (!demo && quote.lastClosedAtSec > 0 && barAgeSec > STALE_CLOSED_BAR_SEC) {
      return NextResponse.json({
        ok: true,
        triggered: false,
        skipped: 'market-closed',
        symbol: tick.symbol,
        price: tick.price,
        last_closed_bar_age_min: Math.round(barAgeSec / 60),
        engine: getMarketListenerStatus(),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // ── OTAK (satu-satunya): EMA9/21 cross + RSI filter di atas
    //    closes candle 15m — stateless, aman utk isolate baru ──
    let signal: SignalPayload
    try {
      signal = demo
        ? {
            // Sinyal TES dengan level kewajaran sekitar harga kini
            isTriggered: true,
            action: 'BUY',
            entryPrice: Number(quote.price.toFixed(2)),
            sl: Number((quote.price - 5.5).toFixed(2)),
            tp: Number((quote.price + 15.0).toFixed(2)),
          }
        : evaluateCloses(tick.symbol, quote.closes, quote.price)
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: `indikator error: ${e instanceof Error ? e.message : String(e)}` },
        { status: 500 }
      )
    }

    if (!signal.isTriggered) {
      return NextResponse.json({
        ok: true,
        triggered: false,
        symbol: tick.symbol,
        price: tick.price,
        engine: getMarketListenerStatus(),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // ── AKSI: broadcast push user PRO + log market_alerts ──
    // demo=true → judul push diawali 🧪 [TES] oleh broadcastVipSignal
    const result = await broadcastVipSignal(signal, tick, { demo })
    return NextResponse.json({
      ok: true,
      triggered: true,
      demo,
      symbol: tick.symbol,
      price: tick.price,
      signal: { action: signal.action, entry: signal.entryPrice, sl: signal.sl, tp: signal.tp },
      broadcast: result,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  } finally {
    running = false
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handle(request)
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handle(request)
}
