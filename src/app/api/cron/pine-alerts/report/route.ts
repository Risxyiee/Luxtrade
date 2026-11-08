/**
 * ============================================================
 * POST /api/cron/pine-alerts/report — hasil evaluasi GHA runner
 * ============================================================
 * Pasangan /payload: GitHub Actions runner menjalankan engine
 * PineTS (Node penuh — codegen diizinkan) atas paket grup, lalu
 * POST hasil ke sini. Server yang melakukan dedupe per-bar
 * (pine_alert_log unique) + push layar HP (push-notify.ts) —
 * logika kirim IDENTIK dengan cron CF (sendAlertTriggers).
 *
 * Body: { results: [{ scriptId, scriptName, symbol, interval,
 *          ok, error?, triggers: [{signal,message,time,price}],
 *          users: [{userId, sinceSec?}] }] }
 * Response: { ok, sent, groupsOk, groupsErr, details }
 *
 * Auth: x-cron-secret / ?secret= / Bearer — PINE_ALERT_CRON_SECRET
 * ATAU CRON_SECRET (fail-closed; dev lokal tanpa secret diizinkan).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import { sendAlertTriggers, sanitizeSymbol, normalizePineInterval, persistEvalHealth } from '@/lib/pine-alert-runner'
import type { AlertTrigger, RunnerUser } from '@/lib/pine-alert-runner'

export const dynamic = 'force-dynamic'

const MAX_RESULTS = 60
const MAX_TRIGGERS_PER_GROUP = 20
const MAX_USERS_PER_GROUP = 100

function isAuthorized(request: NextRequest): boolean {
  const validSecrets = [
    String(process.env.PINE_ALERT_CRON_SECRET || '').trim(),
    String(process.env.CRON_SECRET || '').trim(),
  ].filter(Boolean)
  if (!validSecrets.length) return process.env.NODE_ENV === 'development'
  const provided = String(
    request.headers.get('x-cron-secret')
    || new URL(request.url).searchParams.get('secret')
    || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    || '',
  ).trim()
  return !!provided && validSecrets.includes(provided)
}

interface ReportResult {
  scriptId?: string
  scriptName?: string
  symbol?: string
  interval?: string
  ok?: boolean
  error?: string
  triggers?: Array<{ signal?: string; message?: string; time?: number; price?: number }>
  users?: Array<{ userId?: string; sinceSec?: number }>
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { results?: ReportResult[] } | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const results = (Array.isArray(body?.results) ? body!.results : []).slice(0, MAX_RESULTS)
  if (!results.length) {
    return NextResponse.json({ ok: true, sent: 0, groupsOk: 0, groupsErr: 0, message: 'tidak ada hasil' })
  }

  const supabase = await getSupabaseAdminAsync()
  if (!supabase) return NextResponse.json({ error: 'Supabase service role tidak tersedia' }, { status: 503 })

  let sent = 0
  let groupsOk = 0
  let groupsErr = 0
  const details: Array<{ scriptId: string; symbol: string; interval: string; ok: boolean; sent?: number; error?: string }> = []

  for (const r of results) {
    const scriptId = String(r?.scriptId || '').slice(0, 64)
    const scriptName = String(r?.scriptName || 'Pine Script').slice(0, 80)
    const symbol = sanitizeSymbol(String(r?.symbol || ''))
    const interval = normalizePineInterval(String(r?.interval || '1h'))
    if (!scriptId || symbol.length < 3) {
      groupsErr++
      details.push({ scriptId: scriptId || '?', symbol, interval, ok: false, error: 'scriptId/symbol tidak valid' })
      continue
    }

    if (!r?.ok) {
      /* Evaluasi gagal di runner (compile error user, candle kosong, dsb.)
         — dicatat utk visibilitas, TIDAK fatal. Migrasi 044: verdict
         gagal disimpan ke langganan → UI menampilkan ALASAN NYATA ke
         user (dulu hanya di log GHA → user merasa "skrip tidak jalan"). */
      groupsErr++
      const errText = String(r?.error || 'evaluasi gagal').slice(0, 200)
      details.push({ scriptId, symbol, interval, ok: false, error: errText })
      try { await persistEvalHealth(supabase, { scriptId, symbol, interval }, { ok: false, error: errText }) } catch { /* non-kritis */ }
      continue
    }

    /* Normalisasi trigger dari runner — time = epoch DETIK */
    const triggers: AlertTrigger[] = (Array.isArray(r.triggers) ? r.triggers : [])
      .slice(0, MAX_TRIGGERS_PER_GROUP)
      .filter((t) => Number.isFinite(Number(t?.time)) && String(t?.signal || '').length > 0)
      .map((t) => ({
        signal: String(t.signal).toUpperCase().slice(0, 40),
        message: String(t.message || t.signal || 'Sinyal indikator').slice(0, 200),
        time: Math.floor(Number(t.time)),
        price: Number.isFinite(Number(t.price)) ? Number(t.price) : 0,
      }))

    const users: RunnerUser[] = (Array.isArray(r.users) ? r.users : [])
      .slice(0, MAX_USERS_PER_GROUP)
      .filter((u) => typeof u?.userId === 'string' && u.userId.length > 10)
      .map((u) => ({
        userId: String(u.userId),
        ...(Number.isFinite(Number(u?.sinceSec)) && Number(u?.sinceSec) > 0 ? { sinceSec: Math.floor(Number(u.sinceSec)) } : {}),
      }))

    if (!triggers.length || !users.length) {
      groupsOk++
      details.push({ scriptId, symbol, interval, ok: true, sent: 0 })
      /* Migrasi 044: skrip JALAN tanpa sinyal → tandai ok. Ini jawaban
         "skrip beneran jalan ga si?" — UI menampilkan "jalan, kondisi
         belum terpicu" alih-alih diam. */
      try { await persistEvalHealth(supabase, { scriptId, symbol, interval }, { ok: true }) } catch { /* non-kritis */ }
      continue
    }

    try {
      const res = await sendAlertTriggers({ id: scriptId, name: scriptName }, symbol, interval, users, triggers, { writeLog: true })
      sent += res.sent
      groupsOk++
      details.push({ scriptId, symbol, interval, ok: true, sent: res.sent })

      /* Migrasi 044: evaluasi ok + kapan terakhir ada sinyal */
      try { await persistEvalHealth(supabase, { scriptId, symbol, interval }, { ok: true }) } catch { /* non-kritis */ }
      /* info best-effort: kapan terakhir ada sinyal (paritas dgn cron CF) */
      try {
        await supabase
          .from('pine_alert_subscriptions')
          .update({ last_trigger_at: new Date().toISOString() })
          .eq('script_id', scriptId)
          .eq('symbol', symbol)
          .eq('timeframe', interval)
          .eq('enabled', true)
      } catch { /* dekoratif */ }
    } catch (e: any) {
      groupsErr++
      details.push({ scriptId, symbol, interval, ok: false, error: String(e?.message || e).slice(0, 200) })
    }
  }

  return NextResponse.json({ ok: true, sent, groupsOk, groupsErr, details })
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'Gunakan POST dengan body results' }, { status: 405 })
}
