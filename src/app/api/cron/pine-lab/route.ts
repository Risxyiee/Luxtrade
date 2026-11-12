/**
 * ============================================================
 * GET/POST /api/cron/pine-lab — SIKLUS JAM-AN PINE LAB
 * ============================================================
 * Spek item 6 (scheduler):
 *   - Candle H1 ditarik SEKALI per simbol per siklus (dedupe simbol),
 *     siklus penuh hanya jalan sekali per jam (dipanggil cron 5-menit,
 *     rute menjaga cadensanya sendiri via minute % 60).
 *   - Jalankan SEMUA script aktif dari SEMUA user ber-flag.
 *   - Tiap script dieksekusi dalam sandbox Lux Engine (deadline 2 dtk,
 *     cap bar/event) + try/catch per script — SATU script gagal TIDAK
 *     menghentikan yang lain.
 *   - Hanya event BARU yang dipush (dedupe DB pine_events_sent,
 *     unique index user+script+event_id) — ke subscription milik
 *     PEMILIK script (pushToUser per user_id).
 *   - Durasi run per script dicatat (pine_runs + last_run_* di script).
 *   - Log run > 7 hari dibuang.
 *
 * Auth: Bearer/x-cron-secret (pola price-alerts).
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { pushToUser } from '@/lib/push-notify'
import { PINE_LAB_FLAG } from '@/lib/pine-lab/access'
import { PINE_LAB_CONFIG } from '@/lib/pine-lab/config'
import { fetchCandles, makeEventId } from '@/lib/pine-lab/runner'
import { runLuxScript } from '@/engine/lux'
import type { LuxCandle } from '@/engine/lux'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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
  if (!validSecrets.length) return process.env.NODE_ENV === 'development'
  if (provided && validSecrets.includes(provided)) return true
  return process.env.NODE_ENV === 'development'
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runCycle()
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runCycle()
}

async function runCycle(): Promise<NextResponse> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // ── 0) Cadensi: siklus penuh hanya di menit 0-4 (sekali per jam).
  // (Offset zona selalu bulat jam → menit-of-jam sama di WIB maupun UTC.)
  const minuteNow = Math.floor(Date.now() / 60_000) % 60
  if (minuteNow >= 5) {
    return NextResponse.json({ skipped: 'bukan jendela jam-an (hanya menit 0-4)' })
  }

  const t0 = Date.now()
  const summary: Record<string, unknown> = { scripts: 0, ok: 0, failed: 0, eventsNew: 0, pushed: 0 }

  try {
    // ── 1) User ber-flag pine_lab ──
    const { data: flagRows, error: fErr } = await admin
      .from('user_flags')
      .select('user_id')
      .eq('flag', PINE_LAB_FLAG)
    if (fErr) {
      return NextResponse.json({ error: `user_flags belum siap: ${fErr.message}` }, { status: 500 })
    }
    const flagged = new Set((flagRows ?? []).map((r) => String(r.user_id)))
    if (!flagged.size) return NextResponse.json({ ...summary, skipped: 'tidak ada user ber-flag' })

    // ── 2) Semua script AKTIF milik user ber-flag ──
    const { data: scripts, error: sErr } = await admin
      .from('pine_scripts')
      .select('id, user_id, name, symbol, source')
      .eq('active', true)
    if (sErr) {
      return NextResponse.json({ error: `pine_scripts belum siap: ${sErr.message}` }, { status: 500 })
    }
    const mine = (scripts ?? []).filter((s) => flagged.has(String(s.user_id)))
    summary.scripts = mine.length
    if (!mine.length) return NextResponse.json({ ...summary, skipped: 'tidak ada script aktif' })

    // ── 3) Tarik candle H1 SEKALI per simbol ──
    const candlesBySymbol = new Map<string, LuxCandle[]>()
    const symbols = [...new Set(mine.map((s) => String(s.symbol || PINE_LAB_CONFIG.DEFAULT_SYMBOL)))]
    await Promise.all(
      symbols.map(async (sym) => {
        const rows = await fetchCandles(sym, PINE_LAB_CONFIG.CRON_CANDLE_LIMIT)
        if (rows.length) candlesBySymbol.set(sym, rows)
      })
    )

    // ── 4) Jalankan tiap script — isolasi penuh per script ──
    for (const script of mine) {
      const sym = String(script.symbol || PINE_LAB_CONFIG.DEFAULT_SYMBOL)
      const candles = candlesBySymbol.get(sym)
      let ok = false
      let durationMs = 0
      let eventsCount = 0
      let errorCode: string | null = null
      let errorMessage: string | null = null
      let events: { time: number; title: string; message: string }[] = []

      try {
        if (!candles || !candles.length) {
          errorCode = 'NO_DATA'
          errorMessage = 'Candle tidak tersedia siklus ini'
        } else {
          const run = runLuxScript(script.source, candles, {
            deadlineMs: PINE_LAB_CONFIG.ENGINE_DEADLINE_MS,
            maxBars: PINE_LAB_CONFIG.CRON_CANDLE_LIMIT,
            maxEvents: PINE_LAB_CONFIG.MAX_EVENTS_PER_RUN,
          })
          durationMs = run.durationMs
          eventsCount = run.events.length
          ok = run.ok
          if (!run.ok) {
            errorCode = run.errorCode ?? 'RUNTIME_ERROR'
            errorMessage = run.error ?? 'Error tidak diketahui'
          } else {
            events = run.events
          }
        }
      } catch (e) {
        // Engine TIDAK seharusnya melempar — tameng terakhir agar
        // satu script gagal tidak menghentikan script lain.
        ok = false
        errorCode = 'RUNTIME_ERROR'
        errorMessage = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)
      }

      // ── 5) Catat run + status script ──
      await admin.from('pine_runs').insert({
        user_id: script.user_id,
        script_id: script.id,
        trigger: 'cron',
        ok,
        duration_ms: Math.round(durationMs),
        bars: candles?.length ?? 0,
        events: eventsCount,
        error_code: errorCode,
        error_message: errorMessage,
      })
      await admin
        .from('pine_scripts')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_ms: Math.round(durationMs),
          last_error: ok ? null : (errorMessage ?? 'Error'),
        })
        .eq('id', script.id)
        .eq('user_id', script.user_id)

      if (ok) summary.ok = ((summary.ok as number) ?? 0) + 1
      else summary.failed = ((summary.failed as number) ?? 0) + 1

      // ── 6) Event BARU saja → dedupe DB → push ke pemilik ──
      if (events.length) {
        const rows = events.map((ev) => ({
          user_id: script.user_id,
          script_id: script.id,
          event_id: makeEventId(script.id, ev),
        }))
        // ignoreDuplicates + unique index (user, script, event_id):
        // yang balik HANYA baris benar-benar baru → itu yang dipush.
        const { data: inserted } = await admin
          .from('pine_events_sent')
          .insert(rows, { ignoreDuplicates: true, onConflict: 'user_id,script_id,event_id' })
          .select('event_id')
        const newIds = new Set((inserted ?? []).map((r) => r.event_id))
        const fresh = events.filter((ev) => newIds.has(makeEventId(script.id, ev)))
        summary.eventsNew = ((summary.eventsNew as number) ?? 0) + fresh.length

        for (const ev of fresh.slice(0, 3)) {
          // maks 3 push per script per jam (anti-spam; sisanya tercatat di run log)
          const res = await pushToUser(
            admin,
            String(script.user_id),
            {
              title: `Lux Lab · ${String(script.name).slice(0, 60)}`,
              body: `[${sym} H1] ${ev.title}: ${ev.message}`.slice(0, 220),
              tag: 'pine-lab',
              url: '/pine-lab',
              type: 'pine-lab',
            },
            { dedupe: false } // dedupe SUDAH oleh pine_events_sent DB-level
          )
          summary.pushed = ((summary.pushed as number) ?? 0) + (res.sent || 0)
        }
      }
    }

    // ── 7) Housekeeping: log run > retensi dibuang ──
    const cutoff = new Date(Date.now() - PINE_LAB_CONFIG.RUN_LOG_RETENTION_DAYS * 24 * 3600 * 1000).toISOString()
    await admin.from('pine_runs').delete().lt('created_at', cutoff)

    summary.durationMs = Date.now() - t0
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    console.error('[cron/pine-lab]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
