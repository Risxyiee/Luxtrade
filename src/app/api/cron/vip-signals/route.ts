import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import { getSelfFetch } from '@/lib/cloudflare-bindings'
import {
  evaluateCustomIndicator,
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
 * binding anti-522, pola price-alerts) → otak indikator yang SAMA
 * dengan jalur WS: evaluateCustomIndicator() di
 * src/services/marketListener.ts.
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

/** Harga terakhir XAU/USD — via /api/candles (SELF binding anti-522) */
async function fetchLastPrice(): Promise<{ price: number; symbol: string } | null> {
  try {
    const quoteUrl = `${SITE_URL}/api/candles?symbol=${encodeURIComponent(SYMBOL)}&interval=5m&limit=1`
    const selfFetch = await getSelfFetch()
    const res = selfFetch
      ? await selfFetch(quoteUrl, { signal: AbortSignal.timeout(12_000) })
      : await fetch(quoteUrl, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const json = await res.json()
    const bars = Array.isArray(json?.data) ? json.data : []
    const last = bars[bars.length - 1]
    const price = Number(last?.close)
    if (!Number.isFinite(price) || price <= 0) return null
    return { price, symbol: String(last?.symbol || 'XAU/USD') }
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
    const quote = await fetchLastPrice()
    if (!quote) {
      return NextResponse.json(
        { ok: false, error: 'harga XAU/USD tidak tersedia (upstream gagal) — coba lagi nanti' },
        { status: 502 }
      )
    }

    const tick: PriceTick = {
      symbol: 'XAU/USD',
      price: quote.price,
      timestamp: Date.now(),
      source: demo ? 'demo' : 'poll',
    }

    // ── OTAK (satu-satunya): indikator pribadi Bos ──
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
        : evaluateCustomIndicator(tick)
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
