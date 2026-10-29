/**
 * ============================================================
 * /api/cron/pine-alerts — Runner alert Pine 24 jam (Task 44)
 * ============================================================
 * Dipanggil GitHub Actions tiap 5 menit (workflow
 * pine-alerts-cron.yml) ATAU cron Cloudflare tiap 15 menit
 * (worker-entry.ts — backup bila GHA tidak terkonfigurasi) ATAU manual:
 *   curl -X POST -H "x-cron-secret: <SECRET>" https://luxtradee.web.id/api/cron/pine-alerts
 *
 * Alur:
 *   1. Gate secret (env PINE_ALERT_CRON_SECRET, fallback CRON_SECRET
 *      supaya cron internal CF jalan tanpa setup tambahan — kosong
 *      dua-duanya = endpoint mati total, aman default).
 *   2. Baca semua langganan enabled dari pine_alert_subscriptions.
 *   3. Saring: user Pro aktif + Telegram terhubung + skrip aktif.
 *   4. Grup per (script, symbol, timeframe) → 1× fetch candle +
 *      1× headless run untuk SEMUA user dalam grup (hemat kuota).
 *   5. Sinyal dikirim Telegram + dedupe per-bar via pine_alert_log.
 *
 * Anti-nyasar: in-memory lock — run sebelumnya masih jalan → skip.
 * Batas 30 grup/run (aman CPU Cloudflare Workers).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import {
  runAlertGroup, sanitizeSymbol,
  type RunnerScript, type RunnerUser,
} from '@/lib/pine-alert-runner'

export const dynamic = 'force-dynamic'

let running = false
let lastRunAt = 0

function isProRow(p: { is_pro?: boolean; subscription_until?: string | null; pro_expiry?: string | null }): boolean {
  if (p.is_pro !== true) return false
  const until = p.subscription_until || p.pro_expiry
  if (until && new Date(String(until)).getTime() < Date.now()) return false
  return true
}

async function handle(request: NextRequest) {
  /* 1) SECRET GATE — PINE_ALERT_CRON_SECRET (GHA) dulu, fallback
     CRON_SECRET (dipakai cron CF internal worker-entry). Dengan ini
     alert otomatis tetap hidup walau Bos belum set secret khusus. */
  const secret = String(process.env.PINE_ALERT_CRON_SECRET || process.env.CRON_SECRET || '').trim()
  if (!secret) {
    return NextResponse.json({ error: 'PINE_ALERT_CRON_SECRET/CRON_SECRET belum diset — endpoint cron dinonaktifkan' }, { status: 403 })
  }
  const provided = String(
    request.headers.get('x-cron-secret')
    || new URL(request.url).searchParams.get('secret')
    || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    || '',
  ).trim()
  if (provided !== secret) return NextResponse.json({ error: 'Secret salah' }, { status: 401 })

  /* Anti tumpang-tindih (best effort per isolat) */
  if (running && Date.now() - lastRunAt < 4 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'run sebelumnya masih berjalan' })
  }
  running = true
  const started = Date.now()
  try {
    const supabase = await getSupabaseAdminAsync()
    if (!supabase) return NextResponse.json({ error: 'Supabase service role tidak tersedia' }, { status: 503 })

    /* 2) LANGGANAN AKTIF */
    const { data: subs, error: subErr } = await supabase
      .from('pine_alert_subscriptions')
      .select('id, user_id, script_id, symbol, timeframe')
      .eq('enabled', true)
      .limit(200)
    if (subErr) {
      return NextResponse.json({ error: subErr.message.slice(0, 160) }, { status: 500 })
    }
    if (!subs?.length) {
      lastRunAt = Date.now()
      return NextResponse.json({ ok: true, checked: 0, groups: 0, sent: 0, durationMs: Date.now() - started })
    }

    const userIds = [...new Set(subs.map((s: any) => s.user_id))]
    const scriptIds = [...new Set(subs.map((s: any) => s.script_id))]

    /* 3) SKRIP AKTIF + PROFIL (pro & telegram) — sekali query per run */
    const [scriptsRes, profRes] = await Promise.all([
      supabase.from('protected_scripts')
        .select('id, slug, name, source, alert_rules')
        .eq('is_active', true)
        .in('id', scriptIds),
      supabase.from('profiles')
        .select('id, telegram_chat_id, is_pro, subscription_until, pro_expiry')
        .in('id', userIds),
    ])

    const scripts = new Map<string, RunnerScript>()
    for (const r of scriptsRes.data || []) scripts.set(r.id, r as RunnerScript)

    const users = new Map<string, RunnerUser>()
    for (const p of profRes.data || []) {
      const chatId = String((p as any).telegram_chat_id || '').trim()
      if (chatId && isProRow(p as any)) users.set(p.id, { userId: p.id, chatId })
    }

    /* 4) GRUP per (script, symbol, timeframe) */
    const groups = new Map<string, { script: RunnerScript; symbol: string; interval: string; users: RunnerUser[] }>()
    for (const s of subs as Array<Record<string, any>>) {
      const script = scripts.get(s.script_id)
      if (!script) continue // skrip dinonaktifkan/dihapus → lewati
      const u = users.get(s.user_id)
      if (!u) continue // bukan Pro / Telegram belum terhubung → lewati
      const sym = sanitizeSymbol(String(s.symbol || ''))
      if (sym.length < 3) continue
      const tf = String(s.timeframe || '1h')
      const key = `${script.id}|${sym}|${tf}`
      const g = groups.get(key) || { script, symbol: sym, interval: tf, users: [] as RunnerUser[] }
      if (!g.users.some((x) => x.userId === u.userId)) g.users.push(u)
      groups.set(key, g)
    }

    /* 5) RUN — batas aman per run */
    let sent = 0
    let groupRuns = 0
    let errors = 0
    let triggeredSubs = 0
    const MAX_GROUPS = 30
    for (const g of groups.values()) {
      if (groupRuns >= MAX_GROUPS) break
      try {
        const out = await runAlertGroup(g.script, g.symbol, g.interval, g.users)
        groupRuns++
        if (!out.ok) { errors++; continue }
        sent += out.sent
        if (out.triggers.length) {
          triggeredSubs++
          /* info best-effort: kapan terakhir ada sinyal */
          try {
            await supabase
              .from('pine_alert_subscriptions')
              .update({ last_trigger_at: new Date().toISOString() })
              .eq('script_id', g.script.id)
              .eq('symbol', g.symbol)
              .eq('timeframe', g.interval)
              .eq('enabled', true)
          } catch { /* dekoratif */ }
        }
      } catch (e: any) {
        errors++
        console.error('[pine-alerts-cron] grup gagal:', String(e?.message || e).slice(0, 120))
      }
    }

    lastRunAt = Date.now()
    return NextResponse.json({
      ok: true,
      checked: subs.length,
      groupsRun: groupRuns,
      groupsTotal: groups.size,
      triggeredSubs,
      sent,
      errors,
      durationMs: Date.now() - started,
    })
  } catch (x: any) {
    console.error('[pine-alerts-cron] unhandled:', x)
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  } finally {
    running = false
  }
}

export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }
