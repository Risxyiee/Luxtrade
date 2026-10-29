/**
 * ============================================================
 * POST /api/compile-pine — Protected Custom Pine Script® (Task 41)
 * ============================================================
 * Server-side runner untuk skrip Pine master milik Bos yang
 * TERPROTEKSI:
 *   - Source code TIDAK PERNAH keluar dari server. Client hanya
 *     menerima hasil plot {time, value} untuk digambar di chart.
 *   - Hanya user Pro (profiles.is_pro = true, cek kedaluwarsa)
 *     yang boleh menjalankannya. Free → 403 upgrade.
 *   - Sinyal Entry/SL/TP otomatis ke Telegram user (chat_id dari
 *     profiles.telegram_chat_id), dedupe per-bar via pine_alert_log.
 *
 * GET  → daftar skrip terproteksi (id/slug/nama/deskripsi SAJA)
 *         + status isPro (badge UI).
 * POST → { scriptId | slug, symbol, interval } → { plots, meta }
 *
 * Env: TELEGRAM_BOT_TOKEN (alert) — Supabase service role (sudah ada)
 * SQL wajib: docs/PROTECTED_SCRIPTS.sql (Supabase SQL Editor)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { readIsPro } from '@/lib/user-quota'
import {
  runPineHeadless, evaluateAlertRules, sendTelegramToUser, formatSignalMessage,
  fetchServerCandles,
  type AlertRule, type PlotSeries,
} from '@/lib/pine-protected'
import { ensureDefaultScript, DEFAULT_PINE_SOURCE, DEFAULT_PINE_NAME, DEFAULT_PINE_DESCRIPTION } from '@/lib/pine-default-script'
import { DEFAULT_PINE_SLUG } from '@/lib/pine-default-meta'

export const dynamic = 'force-dynamic'

/* ============================================================
   CACHE PLOT SERVER (in-memory, 3 menit) — run engine Pine mahal
   (CPU): fetch 2000 candle + eksekusi skrip per bar. Plot hasil run
   praktis tak berubah dalam hitungan menit, jadi SEMUA client yang
   memakai (skrip, simbol, tf) sama berbagi SATU run — penting di
   Cloudflare Workers (budget CPU ketat) & saat banyak user online.
   ============================================================ */
const plotServerCache = new Map<string, { at: number; payload: any }>()
const PLOT_CACHE_TTL_MS = 3 * 60 * 1000

/* Vela timeframe kanonik (menit, string) → format interval server */
const TF_NORMALIZE: Record<string, string> = {
  '5': '5m', '15': '15m', '30': '30m', '60': '1h', '120': '2h', '240': '4h',
  '1D': '1d', 'D': '1d', '1440': '1d', '1W': '1w', 'W': '1w', '10080': '1w',
}
function normalizeInterval(tf: string): string {
  const t = String(tf || '').trim()
  if (TF_NORMALIZE[t]) return TF_NORMALIZE[t]
  if (/^\d+m$|^\d+h$|^1d$|^1w$/.test(t)) return t
  return '1h'
}

/* Dedupe lapis-2 in-memory (cadangan bila tabel log belum ada unique index) */
const recentSends = new Map<string, number>()
function memDedupeOk(key: string): boolean {
  const now = Date.now()
  const last = recentSends.get(key) || 0
  if (now - last < 5 * 60 * 1000) return false // 5 menit
  recentSends.set(key, now)
  if (recentSends.size > 2000) {
    for (const [k, t] of recentSends) if (now - t > 10 * 60 * 1000) recentSends.delete(k)
  }
  return true
}

interface ProtectedScriptRow {
  id: string
  slug: string
  name: string
  description: string | null
  source: string
  alert_rules: AlertRule[] | null
}

/* ============================================================
   GET — daftar skrip (TANPA source) + status Pro
   ============================================================ */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const isPro = await readIsPro(auth.user.id)

    const supabase = getSupabaseAdmin()
    /* Auto-seed skrip default (Luxtradee Candle Impulsif v5) —
       tanpa SQL manual: user free pun langsung melihat chip-nya. */
    try { await ensureDefaultScript() } catch { /* best-effort */ }
    let scripts: Array<{ id: string; slug: string; name: string; description: string | null }> = []
    if (supabase) {
      const { data, error } = await supabase
        .from('protected_scripts')
        .select('id, slug, name, description')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (!error && Array.isArray(data)) scripts = data
      else if (error) console.error('[compile-pine] list gagal:', error.message)
    }
    /* TANPA DB → tetap tampilkan skrip default (meta dari kode,
       source tidak pernah keluar server) — chip & auto-load tetap hidup. */
    if (!scripts.length) {
      scripts = [{ id: DEFAULT_PINE_SLUG, slug: DEFAULT_PINE_SLUG, name: DEFAULT_PINE_NAME, description: DEFAULT_PINE_DESCRIPTION }]
    }
    return NextResponse.json({ isPro, scripts })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 140) }, { status: 500 })
  }
}

/* ============================================================
   POST — jalankan skrip terproteksi (Pro saja), kembalikan plots
   ============================================================ */
export async function POST(request: NextRequest) {
  try {
    /* 1) AUTH */
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id

    /* 2) GATE AKSES:
       - Skrip DEFAULT (Impulsive Breakout XAUUSD v4): SEMUA user
         boleh MENJALANKAN untuk MELIHAT (permintaan Bos — free
         hanya bisa liat). Notifikasi Telegram tetap khusus Pro.
       - Skrip terproteksi lain: Pro saja. */
    const isPro = await readIsPro(userId)

    /* 3) BODY */
    const body = await request.json().catch(() => null) as
      { scriptId?: string; slug?: string; symbol?: string; interval?: string; timeframe?: string } | null
    const symbol = String(body?.symbol || '').trim().toUpperCase()
    const interval = normalizeInterval(String(body?.interval || body?.timeframe || '60'))
    if (!symbol) return NextResponse.json({ error: 'symbol wajib diisi' }, { status: 400 })

    /* 4) MUAT SKRIP (service role — tabel terkunci dari client)
       scriptId bisa UUID ATAU slug. TANPA DB: skrip DEFAULT tetap
       jalan dari KODE (source tetap tidak pernah ke browser) —
       chart tetap menggambar Entry/SL/TP walau Supabase sedang
       tidak terjangkau (fix: chip diklik tapi garis tak muncul
       tanpa penjelasan). */
    const supabase = getSupabaseAdmin()
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const idOrSlug = String(body?.scriptId || body?.slug || '').trim()
    if (!idOrSlug) return NextResponse.json({ error: 'scriptId atau slug wajib' }, { status: 400 })
    let row: ProtectedScriptRow | null = null
    if (supabase) {
      let q = supabase.from('protected_scripts').select('id, slug, name, description, source, alert_rules').eq('is_active', true)
      q = UUID_RE.test(idOrSlug) ? q.eq('id', idOrSlug) : q.eq('slug', idOrSlug)
      const { data, error: rowErr } = await q.maybeSingle() as { data: ProtectedScriptRow | null; error: any }
      if (rowErr) console.error('[compile-pine] muat skrip gagal:', rowErr?.message)
      row = data || null
    }
    const isDefault = (row?.slug || idOrSlug) === DEFAULT_PINE_SLUG
    if (!row && isDefault) {
      /* FALLBACK TANPA DB — source default dari kode (server only) */
      row = {
        id: DEFAULT_PINE_SLUG, slug: DEFAULT_PINE_SLUG,
        name: DEFAULT_PINE_NAME, description: DEFAULT_PINE_DESCRIPTION,
        source: DEFAULT_PINE_SOURCE, alert_rules: null,
      }
    }
    if (!row) return NextResponse.json({ error: 'Skrip terproteksi tidak ditemukan / tidak aktif' }, { status: 404 })

    if (!isPro && !isDefault) {
      return NextResponse.json({
        error: 'Indikator terproteksi Luxtradee khusus member Pro. Upgrade untuk mengaktifkan skrip sinyal eksklusif ini.',
        upgrade: true,
      }, { status: 403 })
    }

    /* 5) CACHE PLOT SERVER — hit ke cache = tanpa fetch candle &
       tanpa run engine (CPU nol, respons instan). */
    const cacheKey = `${row.id}:${symbol}:${interval}`
    const cached = plotServerCache.get(cacheKey)
    if (cached && Date.now() - cached.at < PLOT_CACHE_TTL_MS) {
      return NextResponse.json({ ...cached.payload, cached: true })
    }

    /* 6) CANDLE SERVER (TradingView → TwelveData → Yahoo — urutan FINAL Bos)
       DEPTH 2000 bar (Bos: backtest salah krn data pendek — 300 bar 1h
       cuma ±2 minggu sehingga sinyal cuma muncul 2×; 2000 bar 1h ≈
       3–4 bulan → sampel backtest layak). Server-candles menarik
       penuh: TV series ≤5000, TD outputsize 5000, Yahoo period paging. */
    const cd = await fetchServerCandles(symbol, interval, 2000)
    if (!cd) {
      return NextResponse.json({ error: `Data candle ${symbol} ${interval} tidak tersedia dari semua sumber server` }, { status: 502 })
    }

    /* 7) HEADLESS RUN — source tetap di server */
    const run = await runPineHeadless(row.source, symbol, interval, cd.bars)
    if (!run.ok || !run.plots?.length) {
      return NextResponse.json({ error: run.error || 'Skrip tidak menghasilkan plot' }, { status: 422 })
    }
    /* Plot helper (prefix _) = state utk alert_rules — JANGAN dikirim
       ke chart; evaluasi rules tetap pakai plots lengkap di bawah. */
    const visiblePlots = run.plots.filter((p) => !p.key.startsWith('_'))
    if (!visiblePlots.length) {
      return NextResponse.json({ error: 'Skrip tidak menghasilkan plot' }, { status: 422 })
    }

    /* 8) ALERT — hanya user Pro (free hanya lihat, tanpa notifikasi).
       Dedupe per-bar via pine_alert_log. */
    const signalsSent = isPro
      ? await detectAndDispatch({
          userId, script: row, symbol, interval,
          plots: run.plots, bars: cd.bars,
          engineAlerts: run.engineAlerts || [],
        })
      : 0

    /* 9) RESPONS — plots SAJA. Tanpa source. Tanpa editor. */
    const payload = {
      success: true,
      isPro,
      meta: { title: run.title || row.name, overlay: run.overlay !== false, source: cd.source },
      plots: visiblePlots,
      signalsSent,
      fetchedAt: new Date().toISOString(),
    }
    plotServerCache.set(cacheKey, { at: Date.now(), payload })
    if (plotServerCache.size > 120) {
      const oldest = [...plotServerCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) plotServerCache.delete(oldest[0])
    }
    return NextResponse.json(payload)
  } catch (x: any) {
    console.error('[compile-pine] unhandled:', x)
    return NextResponse.json({ error: String(x?.message || x).slice(0, 140) }, { status: 500 })
  }
}

/* ============================================================
   Alert dispatch: engine alerts (alert()) + alert_rules → Telegram
   ============================================================ */
async function detectAndDispatch(opts: {
  userId: string
  script: ProtectedScriptRow
  symbol: string
  interval: string
  plots: PlotSeries[]
  bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>
  engineAlerts: Array<{ message: string; time: number; barIndex: number }>
}): Promise<number> {
  const { userId, script, symbol, interval, plots, bars, engineAlerts } = opts
  if (!bars.length) return 0
  const lastBar = bars[bars.length - 1]
  const lastTimeSec = lastBar.time

  /* 7a) Sinyal dari event engine (script memakai alert()) — hanya bar terakhir */
  const triggers: Array<{ signal: string; message: string; time: number; price: number }> = []
  for (const a of engineAlerts) {
    const barSec = Number(a.barIndex) >= 0 && bars[a.barIndex] ? bars[a.barIndex].time : Math.floor(a.time / 1000)
    if (barSec !== lastTimeSec) continue // historis → abaikan (anti spam)
    const msg = String(a.message || 'Sinyal indikator')
    const sig = /TP|TAKE.?PROFIT/i.test(msg) ? 'TAKE_PROFIT'
      : /SL|STOP.?LOSS/i.test(msg) ? 'STOP_LOSS'
      : /BUY|LONG|BULL/i.test(msg) ? 'ENTRY_LONG'
      : /SELL|SHORT|BEAR/i.test(msg) ? 'ENTRY_SHORT' : 'SIGNAL'
    triggers.push({ signal: sig, message: msg, time: lastTimeSec, price: lastBar.close })
  }

  /* 7b) Sinyal dari alert_rules declaratif (skrip tanpa alert()) */
  triggers.push(...evaluateAlertRules(script.alert_rules, plots, bars))

  if (!triggers.length) return 0

  /* Dedupe per (user, script, symbol, signal, bar_time) — tabel log */
  const supabase = getSupabaseAdmin()
  let sent = 0
  for (const t of triggers) {
    const memKey = `${userId}:${script.id}:${symbol}:${t.signal}:${t.time}`
    if (!memDedupeOk(memKey)) continue

    let isNew = true
    if (supabase) {
      const { data: ins, error: logErr } = await supabase
        .from('pine_alert_log')
        .insert({
          user_id: userId, script_id: script.id, symbol,
          signal_type: t.signal, bar_time: new Date(t.time * 1000).toISOString(),
          price: t.price,
        })
        .select('id')
        .ignoreDuplicates()
      if (logErr) {
        console.error('[compile-pine] log alert gagal (tabel ada?):', logErr.message)
        /* tabel belum dibuat → tetap kirim tapi hanya 1× per 5 menit (memDedupe) */
      } else if (Array.isArray(ins) && ins.length === 0) {
        isNew = false // sudah pernah dikirim untuk bar ini
      }
    }
    if (!isNew) continue

    /* Ambil chat_id user Pro (service role) */
    const { data: prof } = await supabase!
      .from('profiles').select('telegram_chat_id').eq('id', userId).maybeSingle()
    const chatId = String((prof as any)?.telegram_chat_id || '').trim()
    if (!chatId) continue // belum hubungkan Telegram → sinyal dilewati (bukan error)

    const html = formatSignalMessage({
      scriptName: script.name, symbol, interval,
      signal: t.signal, price: t.price, barTimeSec: t.time,
      extra: t.message && t.message !== t.signal ? `💬 ${t.message}` : undefined,
    })
    const okTg = await sendTelegramToUser(chatId, html)
    if (okTg) sent++
  }
  return sent
}
