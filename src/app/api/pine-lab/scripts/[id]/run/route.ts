/**
 * ============================================================
 * POST /api/pine-lab/scripts/[id]/run — run manual (test) script
 * ============================================================
 * Spek item 5 (rate-limit 20 run manual/jam), 6 (durasi dicatat),
 * 7 (rate-limit + isolation):
 *   - Script DIMILIK user (filter user_id) — source user lain tak
 *     terjangkau.
 *   - Kuota run manual dihitung dari tabel pine_runs (DB-level,
 *     tahan lintas-isolate) — bukan memory.
 *   - Engine dijalankan dengan deadline 2 dtk (sandbox dalam modul
 *     Lux Engine) — script berat TIDAK menggantung route.
 *   - Hasil disanitasi: event dipotong (engine sudah memotong),
 *     plots dibatasi 12, source tidak pernah dikirim balik.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePineLab } from '@/lib/pine-lab/access'
import { PINE_LAB_CONFIG, runLimitMessage } from '@/lib/pine-lab/config'
import { runOneScript } from '@/lib/pine-lab/runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requirePineLab(request)
  if (gate instanceof NextResponse) return gate
  const { user, admin } = gate
  const { id } = await params

  try {
    // ── Rate limit: hitung run manual 60 menit terakhir (MILIK user ini) ──
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentRuns, error: rlErr } = await admin
      .from('pine_runs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('trigger', 'manual')
      .gte('created_at', since)
    if (rlErr) {
      return NextResponse.json({ error: 'Gagal cek rate limit (DB belum siap).' }, { status: 500 })
    }
    if ((recentRuns ?? 0) >= PINE_LAB_CONFIG.MAX_MANUAL_RUNS_PER_HOUR) {
      return NextResponse.json({ error: runLimitMessage() }, { status: 429 })
    }

    // ── Ambil script MILIK user ──
    const { data: script, error: sErr } = await admin
      .from('pine_scripts')
      .select('id, symbol, source')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (sErr || !script) {
      return NextResponse.json({ error: 'Script tidak ditemukan.' }, { status: 404 })
    }

    // ── Jalankan (sandbox engine: deadline + caps) ──
    const { run, candleCount, dataFrom, dataTo } = await runOneScript(
      script,
      PINE_LAB_CONFIG.MANUAL_CANDLE_LIMIT,
    )

    // ── Catat durasi (spek item 6) ──
    await admin.from('pine_runs').insert({
      user_id: user.id,
      script_id: script.id,
      trigger: 'manual',
      ok: run.ok,
      duration_ms: Math.round(run.durationMs),
      bars: run.bars || candleCount,
      events: run.events.length,
      error_code: run.errorCode ?? null,
      error_message: run.error ?? null,
    })

    // ── Simpan status terakhir di script (diagnosa cepat di list) ──
    await admin
      .from('pine_scripts')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_ms: Math.round(run.durationMs),
        last_error: run.ok ? null : (run.error ?? 'Error tidak diketahui'),
      })
      .eq('id', script.id)
      .eq('user_id', user.id)

    // ── Respons disanitasi ──
    return NextResponse.json({
      ok: run.ok,
      error: run.error ?? null,
      errorCode: run.errorCode ?? null,
      bars: run.bars,
      durationMs: Math.round(run.durationMs),
      candleCount,
      symbol: script.symbol,
      dataFrom: dataFrom ?? null,
      dataTo: dataTo ?? null,
      events: run.events.slice(0, PINE_LAB_CONFIG.MAX_EVENTS_PER_RUN),
      plots: run.plots.slice(0, 12),
    })
  } catch (e) {
    console.error('[pine-lab/run POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
