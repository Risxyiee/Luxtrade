import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { pushToUser } from '@/lib/push-notify'
import { getSelfFetch } from '@/lib/cloudflare-bindings'
import { isXauLikeSymbol, isXauMarketOpen } from '@/lib/market-hours'

/**
 * GET/POST /api/cron/price-alerts
 * Cron job: cek watchlist user yang punya target_price → push layar HP
 * saat harga MENYENTUH atau MENYEBRANG target. Dedupe per (user, item,
 * target) via tabel watchlist_price_alerts (SQL 20261020) — 1 alert per
 * target sampai user mengubah target (re-arm otomatis).
 *
 * Jadwal: tiap 15 menit — numpang slot cron 15-menit-an di worker-entry.ts
 * (CF Free = maks 5 cron trigger, slot tidak boleh nambah).
 *
 * Deteksi (dari 2 candle terakhir interval 5m):
 *   touched      → high ≥ target ≥ low  (bar menyentuh target)
 *   crossedUp    → prevClose < target ≤ lastClose
 *   crossedDown  → prevClose > target ≥ lastClose
 *
 * Auth: Bearer PINE_ALERT_CRON_SECRET / CRON_SECRET
 * (sama dengan pine-alerts — satu sumber secret untuk semua cron).
 * Fail-closed tanpa secret di produksi.
 */
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

// Anti-nyasar: lock in-memory seperti pine-alerts
let running = false
let lastRunAt = 0

// Fallback dedupe kalau tabel watchlist_price_alerts belum dibuat
// (migrasi belum dijalankan) — best-effort, hilang saat isolate recycle.
const memAlerted = new Map<string, number>()
const MEM_TTL_MS = 6 * 60 * 60 * 1000 // 6 jam

function memAlertOk(key: string): boolean {
  const now = Date.now()
  const last = memAlerted.get(key)
  if (last !== undefined && now - last < MEM_TTL_MS) return false
  memAlerted.set(key, now)
  if (memAlerted.size > 2000) {
    for (const [k, t] of memAlerted) if (now - t > MEM_TTL_MS) memAlerted.delete(k)
  }
  return true
}

let missingTableWarned = false

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided = String(
    request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('x-cron-secret') ||
      ''
  ).trim()
  const validSecrets = [
    String(process.env.PINE_ALERT_CRON_SECRET || '').trim(),
    String(process.env.CRON_SECRET || '').trim(),
    // SECURITY (audit #17): VAPID_PRIVATE_KEY dihapus dari daftar secret cron
  ].filter(Boolean)
  if (!validSecrets.length) {
    return process.env.NODE_ENV === 'development'
  }
  if (provided && validSecrets.includes(provided)) return true
  return process.env.NODE_ENV === 'development'
}

interface WatchRow {
  id: string
  user_id: string
  symbol: string
  target_price: number
  notes?: string | null
}

interface Quote {
  lastClose: number
  prevClose: number
  high: number
  low: number
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    /* FIX Bos 6 Nov: SELF binding dulu (anti 522/loop edge di Workers —
       pola sama dgn cron lain commit 840759dd), fallback fetch publik di dev. */
    const quoteUrl = `${SITE_URL}/api/candles?symbol=${encodeURIComponent(symbol)}&interval=5m&limit=2`
    const selfFetch = await getSelfFetch()
    const res = selfFetch
      ? await selfFetch(quoteUrl, { signal: AbortSignal.timeout(12_000) })
      : await fetch(quoteUrl, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const json = await res.json()
    const bars = Array.isArray(json?.data) ? json.data : []
    if (!bars.length) return null
    const last = bars[bars.length - 1]
    const prev = bars.length > 1 ? bars[bars.length - 2] : last
    const q = {
      lastClose: Number(last.close),
      prevClose: Number(prev.close),
      high: Number(last.high),
      low: Number(last.low),
    }
    if (![q.lastClose, q.prevClose, q.high, q.low].every((n) => Number.isFinite(n) && n > 0)) return null
    return q
  } catch {
    return null
  }
}

function isHit(t: number, q: Quote): boolean {
  const touched = q.high >= t && q.low <= t
  const crossedUp = q.prevClose < t && q.lastClose >= t
  const crossedDown = q.prevClose > t && q.lastClose <= t
  return touched || crossedUp || crossedDown
}

/** true = boleh alert (belum pernah utk target ini) */
async function claimAlert(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  row: WatchRow,
  price: number
): Promise<boolean> {
  try {
    const { data: ins, error } = await supabase
      .from('watchlist_price_alerts')
      .upsert(
        {
          user_id: row.user_id,
          watchlist_id: row.id,
          symbol: row.symbol,
          target_price: row.target_price,
          triggered_price: price,
        },
        {
          onConflict: 'user_id,watchlist_id,target_price',
          ignoreDuplicates: true,
        }
      )
      .select('id')
    if (error) throw error
    return Array.isArray(ins) ? ins.length > 0 : true
  } catch (e) {
    // Tabel belum ada (migrasi belum jalan) → fallback in-memory 6 jam
    if (!missingTableWarned) {
      missingTableWarned = true
      console.warn('[price-alerts] watchlist_price_alerts belum ada — pakai dedupe in-memory. Jalankan supabase/migrations/20261020_watchlist_price_alerts.sql')
    }
    void e
    return memAlertOk(`${row.user_id}:${row.id}:${row.target_price}`)
  }
}

async function handle(): Promise<NextResponse> {
  const startTime = Date.now()
  if (running && Date.now() - lastRunAt < 10 * 60_000) {
    return NextResponse.json({ skipped: 'run sebelumnya masih jalan' })
  }
  running = true
  lastRunAt = Date.now()

  try {
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin tidak tersedia' }, { status: 500 })
    }

    // 1. Semua watchlist yang punya target (cap 500 biar aman CPU/wall)
    const { data: rows, error } = await supabase
      .from('watchlist')
      .select('id, user_id, symbol, target_price')
      .not('target_price', 'is', null)
      .limit(500)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const watch = ((rows ?? []) as WatchRow[]).filter(
      (r) => r.symbol && Number.isFinite(Number(r.target_price)) && Number(r.target_price) > 0
    )
    if (!watch.length) {
      return NextResponse.json({ ok: true, checked: 0, alerts: 0, symbols: 0 })
    }

    // 2. Unikkan symbol → 1 fetch per symbol (hemat kuota upstream)
    //    Pasar logam tutup (weekend/jeda) → quote = harga beku Jumat;
    //    jangan bandingkan target dgn data basi (push "tercapai" palsu
    //    di hari Minggu). Target dicek lagi begitu pasar buka.
    const symbols = [...new Set(watch.map((r) => r.symbol))].slice(0, 40)
    const quotes = new Map<string, Quote>()
    for (const sym of symbols) {
      if (isXauLikeSymbol(sym) && !isXauMarketOpen()) continue
      const q = await fetchQuote(sym)
      if (q) quotes.set(sym, q)
      await new Promise((r) => setTimeout(r, 150)) // jeda sopan antar upstream
    }

    // 3. Cek tiap target + push
    let alerts = 0
    let skippedDedupe = 0
    const details: { symbol: string; target: number; price: number; user: string }[] = []

    for (const row of watch) {
      const t = Number(row.target_price)
      const q = quotes.get(row.symbol)
      if (!q || !isHit(t, q)) continue

      const ok = await claimAlert(supabase, row, q.lastClose)
      if (!ok) { skippedDedupe++; continue }

      const push = await pushToUser(supabase, row.user_id, {
        title: `🎯 ${row.symbol} sentuh target ${t}`,
        body: `Harga sekarang ~${q.lastClose}${row.notes ? ` · ${row.notes}` : ''}`,
        tag: `pricealert-${row.id}`,
        type: 'price-alert',
        url: '/watchlist',
        urgency: 'high',
      })
      if (push.sent > 0) {
        alerts++
        details.push({ symbol: row.symbol, target: t, price: q.lastClose, user: row.user_id })
      }
    }

    return NextResponse.json({
      ok: true,
      checked: watch.length,
      symbols: symbols.length,
      quotesFetched: quotes.size,
      alerts,
      skippedDedupe,
      details,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
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
  return handle()
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handle()
}
