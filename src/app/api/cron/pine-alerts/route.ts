/**
 * ============================================================
 * /api/cron/pine-alerts — Runner alert Pine 24 jam (Task 44)
 * ============================================================
 * BACKUP path (cron Cloudflare 15 menit via worker-entry.ts). JALUR
 * UTAMA kini GitHub Actions runner (workflow pine-alerts-cron.yml
 * → scripts/pine-alerts-engine.ts → endpoint /payload + /report):
 * runtime workerd MELARANG code generation (`new Function`) yang
 * dibutuhkan engine PineTS → di sini grup Pine ditandai
 * `engineDeferred` (bukan error) dan dievaluasi runner eksternal.
 * Manual: curl -X POST -H "x-cron-secret: <SECRET>" https://luxtradee.web.id/api/cron/pine-alerts
 *
 * Alur:
 *   1. Gate secret (env PINE_ALERT_CRON_SECRET, fallback CRON_SECRET
 *      supaya cron internal CF jalan tanpa setup tambahan — kosong
 *      dua-duanya = endpoint mati total, aman default).
 *   2. Baca semua langganan enabled → grup per (script, symbol, tf).
 *   3. Evaluasi tiap grup (engine → deferred bila runtime larang).
 *   4. Sinyal dikirim sebagai push layar HP + dedupe per-bar via
 *      pine_alert_log.
 *
 * Anti-nyasar: in-memory lock — run sebelumnya masih jalan → skip.
 * Batas 30 grup/run (aman CPU Cloudflare Workers).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import { runAlertGroup, persistEvalHealth } from '@/lib/pine-alert-runner'
import { buildAlertGroups } from '@/lib/pine-alert-groups'

export const dynamic = 'force-dynamic'

let running = false
let lastRunAt = 0

async function handle(request: NextRequest) {
  /* 1) SECRET GATE — terima SALAH SATU secret yang terdaftar:
     PINE_ALERT_CRON_SECRET (GHA workflow) ATAU CRON_SECRET (cron
     internal CF worker-entry kirim Bearer CRON_SECRET/VAPID).
     FIX 401 produksi: dulu route hanya pakai fallback berantai
     (PINE dulu, kalaupun ada) — sementara worker mengirim CRON_SECRET
     → dua secret valid yang beda nilai saling menolak (401 terus).
     Sekarang provided dicocokkan ke SEMUA secret non-kosong. Kosong
     dua-duanya = endpoint mati total (403), aman default. */
  const validSecrets = [
    String(process.env.PINE_ALERT_CRON_SECRET || '').trim(),
    String(process.env.CRON_SECRET || '').trim(),
    // SECURITY (audit #17): VAPID_PRIVATE_KEY dihapus dari daftar secret cron
  ].filter(Boolean)
  if (!validSecrets.length) {
    return NextResponse.json({ error: 'PINE_ALERT_CRON_SECRET/CRON_SECRET belum diset — endpoint cron dinonaktifkan' }, { status: 403 })
  }
  const provided = String(
    request.headers.get('x-cron-secret')
    || new URL(request.url).searchParams.get('secret')
    || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    || '',
  ).trim()
  if (!provided || !validSecrets.includes(provided)) return NextResponse.json({ error: 'Secret salah' }, { status: 401 })

  /* Anti tumpang-tindih (best effort per isolat) */
  if (running && Date.now() - lastRunAt < 4 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'run sebelumnya masih berjalan' })
  }
  running = true
  const started = Date.now()
  try {
    const supabase = await getSupabaseAdminAsync()
    if (!supabase) return NextResponse.json({ error: 'Supabase service role tidak tersedia' }, { status: 503 })

    /* 2+3) GRUP per (script, symbol, timeframe) */
    const built = await buildAlertGroups(supabase)
    if (!built.checked) {
      lastRunAt = Date.now()
      return NextResponse.json({ ok: true, checked: 0, groups: 0, sent: 0, durationMs: Date.now() - started })
    }

    /* 4) RUN — batas aman per run */
    let sent = 0
    let groupRuns = 0
    let errors = 0
    let deferredEngine = 0
    let triggeredSubs = 0
    const MAX_GROUPS = 30
    for (const g of built.groups) {
      if (groupRuns >= MAX_GROUPS) break
      try {
        const out = await runAlertGroup(g.script, g.symbol, g.interval, g.users)
        groupRuns++
        if (!out.ok) {
          /* engineDeferred = keterbatasan runtime workerd (codegen
             dilarang) — BUKAN error; runner GHA yang menangani.
             Kesehatan evaluasi TIDAK ditulis di sini (biar verdict
             beneran dari engine GHA, bukan "tidak bisa jalan"). */
          if (out.engineDeferred) deferredEngine++
          else {
            errors++
            /* Migrasi 044: verdict gagal RIIL (compile error user, dll.)
               disimpan → UI langganan menampilkan alasannya. */
            await persistEvalHealth(supabase, g, { ok: false, error: out.error })
          }
          continue
        }
        /* Migrasi 044: skrip beneran dieksekusi → tandai ok (walaupun
           belum ada sinyal — "jalan, kondisi belum terpicu" justru
           informasi yang selama ini hilang dari user). */
        await persistEvalHealth(supabase, g, { ok: true })
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
      checked: built.checked,
      groupsRun: groupRuns,
      groupsTotal: built.groups.length,
      triggeredSubs,
      sent,
      errors,
      deferredEngine,
      engineNote: deferredEngine > 0 ? 'grup Pine dievaluasi GHA runner (workerd larang codegen)' : undefined,
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
