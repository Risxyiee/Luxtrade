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

export const dynamic = 'force-dynamic'

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

    /* 2) GATE PRO — wajib is_pro true (kedaluwarsa ikut dicek) */
    const isPro = await readIsPro(userId)
    if (!isPro) {
      return NextResponse.json({
        error: 'Indikator terproteksi Luxtradee khusus member Pro. Upgrade untuk mengaktifkan skrip sinyal eksklusif ini.',
        upgrade: true,
      }, { status: 403 })
    }

    /* 3) BODY */
    const body = await request.json().catch(() => null) as
      { scriptId?: string; slug?: string; symbol?: string; interval?: string; timeframe?: string } | null
    const symbol = String(body?.symbol || '').trim().toUpperCase()
    const interval = normalizeInterval(String(body?.interval || body?.timeframe || '60'))
    if (!symbol) return NextResponse.json({ error: 'symbol wajib diisi' }, { status: 400 })

    /* 4) MUAT SKRIP (service role — tabel terkunci dari client) */
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Server belum terhubung Supabase (service role)' }, { status: 500 })
    let q = supabase.from('protected_scripts').select('id, slug, name, description, source, alert_rules').eq('is_active', true)
    if (body?.scriptId) q = q.eq('id', String(body.scriptId))
    else if (body?.slug) q = q.eq('slug', String(body.slug))
    else return NextResponse.json({ error: 'scriptId atau slug wajib' }, { status: 400 })
    const { data: row, error: rowErr } = await q.maybeSingle() as { data: ProtectedScriptRow | null; error: any }
    if (rowErr || !row) return NextResponse.json({ error: 'Skrip terproteksi tidak ditemukan / tidak aktif' }, { status: 404 })

    /* 5) CANDLE SERVER (OANDA → Yahoo → Binance) */
    const cd = await fetchServerCandles(symbol, interval, 300)
    if (!cd) {
      return NextResponse.json({ error: `Data candle ${symbol} ${interval} tidak tersedia dari semua sumber server` }, { status: 502 })
    }

    /* 6) HEADLESS RUN — source tetap di server */
    const run = await runPineHeadless(row.source, symbol, interval, cd.bars)
    if (!run.ok || !run.plots?.length) {
      return NextResponse.json({ error: run.error || 'Skrip tidak menghasilkan plot' }, { status: 422 })
    }

    /* 7) ALERT — deteksi sinyal Entry/SL/TP + kirim Telegram (dedupe per-bar) */
    const signalsSent = await detectAndDispatch({
      userId, script: row, symbol, interval,
      plots: run.plots, bars: cd.bars,
      engineAlerts: run.engineAlerts || [],
    })

    /* 8) RESPONS — plots SAJA. Tanpa source. Tanpa editor. */
    return NextResponse.json({
      success: true,
      isPro: true,
      meta: { title: run.title || row.name, overlay: run.overlay !== false, source: cd.source },
      plots: run.plots,
      signalsSent,
      fetchedAt: new Date().toISOString(),
    })
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
