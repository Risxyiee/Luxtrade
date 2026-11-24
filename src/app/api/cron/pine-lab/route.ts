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
 *   - NOTIF ADMIN: tiap siklus yang benar-benar menjalankan script
 *     kirim ringkasan COMPACT ke Discord admin (sendAdminNotification) —
 *     bukti hidup "Pine Lab beneran jalan" + jumlah sinyal + daftar
 *     script gagal. Matikan via env PINE_LAB_ADMIN_NOTIFY=0.
 *   - BYPASS AKUN ADMIN: cron tidak lagi tergantung seed manual
 *     user_flags — email di ADMIN_EMAILS di-resolve ke user ID via
 *     Supabase auth admin (listUsers) dan ikut dijalankan. Pola sama
 *     dengan gerbang halaman (access.ts) — FIX cron skip senyap.
 *
 * Auth: Bearer/x-cron-secret (pola price-alerts).
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { pushToUser } from '@/lib/push-notify'
import { sendAdminNotification } from '@/lib/admin-notify'
import { ADMIN_EMAILS } from '@/lib/admin-auth'
import { PINE_LAB_CONFIG, PINE_LAB_FLAG } from '@/lib/pine-lab/config'
import { fetchCandles, makeEventId } from '@/lib/pine-lab/runner'
import { runLuxScript } from '@/engine/lux'
import type { LuxCandle } from '@/engine/lux'

/** Jam WIB "HH.MM" untuk stempel waktu ringkasan admin. */
function wibStamp(): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(11, 16)
  }
}

/**
 * Notifikasi admin via Discord — SELALU non-kritis (gagal dikirim =
 * console.warn saja, siklus cron tidak boleh kena). Bisa dimatikan
 * dengan env PINE_LAB_ADMIN_NOTIFY=0 (default ON).
 */
async function notifyAdmin(body: string): Promise<void> {
  const toggle = String(process.env.PINE_LAB_ADMIN_NOTIFY ?? '1').trim().toLowerCase()
  if (toggle === '0' || toggle === 'off' || toggle === 'false') return
  try {
    await sendAdminNotification(body)
  } catch (e) {
    console.warn('[cron/pine-lab] notif admin gagal (non-kritis):', e)
  }
}

/**
 * Resolve email admin (ADMIN_EMAILS) → user ID Supabase via auth admin
 * API. Cron tidak punya session login, jadi bypass "email admin" pada
 * gerbang halaman tidak bisa dipakai langsung — email harus dipetakan
 * ke user ID dulu. Gagal resolve = [] (non-kritis; user ber-flag
 * seed manual tetap jalan seperti biasa).
 */
async function resolveAdminUserIds(
  admin: SupabaseClient
): Promise<string[]> {
  if (!ADMIN_EMAILS.length) return []
  const wanted = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase().trim()))
  const ids: string[] = []
  try {
    // userbase kecil — 1 halaman 1000 cukup; loop tahan sampai 3 halaman
    for (let page = 1; page <= 3; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) {
        console.warn('[cron/pine-lab] resolveAdminUserIds gagal:', error.message)
        return ids
      }
      for (const u of data?.users ?? []) {
        const email = (u.email ?? '').toLowerCase().trim()
        if (email && wanted.has(email)) ids.push(String(u.id))
      }
      if ((data?.users?.length ?? 0) < 1000) break
    }
  } catch (e) {
    console.warn('[cron/pine-lab] resolveAdminUserIds error (non-kritis):', e)
  }
  return ids
}

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
  const failures: string[] = []

  try {
    // ── 1) User ber-flag pine_lab ──
    const { data: flagRows, error: fErr } = await admin
      .from('user_flags')
      .select('user_id')
      .eq('flag', PINE_LAB_FLAG)
    if (fErr) {
      await notifyAdmin(`🚨 Pine Lab · ${wibStamp()} WIB — siklus GAGAL: tabel user_flags bermasalah: ${String(fErr.message).slice(0, 150)}`)
      return NextResponse.json({ error: `user_flags belum siap: ${fErr.message}` }, { status: 500 })
    }
    const flagged = new Set((flagRows ?? []).map((r) => String(r.user_id)))

    // ── BYPASS ADMIN: email admin ikut dijalankan walau flag belum
    //    di-seed manual di user_flags (pola access.ts — akun Bos
    //    tidak pernah boleh ter-skip oleh lupa seed SQL).
    const adminIds = await resolveAdminUserIds(admin)
    for (const id of adminIds) flagged.add(id)
    if (!flagged.size) return NextResponse.json({ ...summary, skipped: 'tidak ada user ber-flag' })

    // ── 2) Semua script AKTIF milik user ber-flag ──
    const { data: scripts, error: sErr } = await admin
      .from('pine_scripts')
      .select('id, user_id, name, symbol, source')
      .eq('active', true)
    if (sErr) {
      await notifyAdmin(`🚨 Pine Lab · ${wibStamp()} WIB — siklus GAGAL: tabel pine_scripts bermasalah: ${String(sErr.message).slice(0, 150)}`)
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
            deadlineMs: PINE_LAB_CONFIG.ENGINE_DEADLINE_MS_CRON,
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
      else {
        summary.failed = ((summary.failed as number) ?? 0) + 1
        failures.push(
          `${String(script.name || script.id).slice(0, 40)} (${sym}): [${errorCode}] ${String(errorMessage ?? '').slice(0, 120)}`
        )
      }

      // ── 6) Event BARU saja → dedupe DB → push ke pemilik ──
      if (events.length) {
        const rows = events.map((ev) => ({
          user_id: script.user_id,
          script_id: script.id,
          event_id: makeEventId(script.id, ev),
        }))
        // upsert + ignoreDuplicates (INSERT ... ON CONFLICT DO NOTHING) —
        // WAJIB lewat .upsert(): .insert() tidak mendukung ignoreDuplicates.
        // unique index (user, script, event_id) dibuat di 20261113_pine_lab_fix.sql;
        // yang balik HANYA baris benar-benar baru → itu yang dipush.
        const { data: inserted } = await admin
          .from('pine_events_sent')
          .upsert(rows, { ignoreDuplicates: true, onConflict: 'user_id,script_id,event_id' })
          .select('event_id')
        const newIds = new Set((inserted ?? []).map((r) => r.event_id))
        const fresh = events.filter((ev) => newIds.has(makeEventId(script.id, ev)))
        summary.eventsNew = ((summary.eventsNew as number) ?? 0) + fresh.length

        // ══ FIX "sinyal BUY baru kok ga ada notif?" (laporan Bos 26-11,
        //    Sprint v11 Univ @ 3656) ══════════════════════════════════════
        // DULU: fresh chronological → fresh.slice(0, 3) mempush 3 event
        // paling LAMA (sisa histori/sisa antrean setelah cron down),
        // sementara sinyal LIVE terbaru bisa jadi #4+ → sudah ditandai
        // "terkirim" di pine_events_sent tapi TIDAK PERNAH di-push
        // (silent drop — event hilang selamanya, ringkasan admin pun
        // tidak menunjukkan apa-apa).
        // KINI: urut TERBARU dulu (time DESC) → sinyal live selalu
        // kebagian push; histori lama yang kepotong kapasitas memang
        // tidak layak di-push (kelihatan di Histori Sinyal UI).
        const freshNewestFirst = [...fresh].sort((a, b) => b.time - a.time)
        let pushNoSubs = 0
        let pushFailed = 0
        for (const ev of freshNewestFirst.slice(0, 3)) {
          // maks 3 push per script per jam (anti-spam) — TERBARU diprioritaskan;
          // sisanya TIDAK ditandai hilang diam-diam: dihitung & dilaporkan
          // ke ringkasan admin di langkah 8.
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
          if (res.skipped === 'no-subs') pushNoSubs++
          else if (res.error) pushFailed++
        }
        const pushedCount = Math.min(fresh.length, 3)
        if (fresh.length > pushedCount) {
          summary.pushDropped =
            ((summary.pushDropped as number) ?? 0) + (fresh.length - pushedCount)
        }
        if (pushNoSubs > 0) {
          summary.pushNoSubs = ((summary.pushNoSubs as number) ?? 0) + pushNoSubs
        }
        if (pushFailed > 0) {
          summary.pushFailed = ((summary.pushFailed as number) ?? 0) + pushFailed
        }
      }
    }

    // ── 7) Housekeeping: log run > retensi dibuang ──
    const cutoff = new Date(Date.now() - PINE_LAB_CONFIG.RUN_LOG_RETENTION_DAYS * 24 * 3600 * 1000).toISOString()
    await admin.from('pine_runs').delete().lt('created_at', cutoff)

    summary.durationMs = Date.now() - t0

    // ── 8) NOTIF ADMIN — bukti hidup per siklus (compact, 1 pesan) ──
    // Hanya bila ADA script yang dijalankan (skipped "tidak ada script"
    // tidak diberitahu — bukan kegagalan, cuma kosong).
    if ((summary.scripts as number) > 0) {
      const lines: string[] = [
        `⚙️ Pine Lab · ${wibStamp()} WIB`,
        `Script jalan: ${summary.scripts} → ✅ ${summary.ok} · ❌ ${summary.failed}`,
      ]
      if ((summary.eventsNew as number) > 0) {
        let line = `🔔 Sinyal baru: ${summary.eventsNew} · Push terkirim: ${summary.pushed}`
        // Transparansi penuh — dulu sinyal yang tidak kebagian push hilang
        // SENYAP (Bos 26-11: "sinyal BUY @ 3656 kok ga ada notif?").
        if ((summary.pushDropped as number) > 0) {
          line += ` · ⏭️ ${summary.pushDropped} sinyal lama tidak di-push (kap 3/script/jam — terbaru diprioritaskan)`
        }
        if ((summary.pushNoSubs as number) > 0) {
          line += ` · ⚠️ ${summary.pushNoSubs} push GAGAL: tidak ada device push terdaftar (aktifkan notifikasi di /pine-lab)`
        }
        if ((summary.pushFailed as number) > 0) {
          line += ` · ❌ ${summary.pushFailed} push gagal kirim (cek log CF)`
        }
        lines.push(line)
      }
      if (failures.length) {
        lines.push('Gagal:')
        for (const f of failures.slice(0, 5)) lines.push(`• ${f}`)
        if (failures.length > 5) lines.push(`… +${failures.length - 5} script gagal lainnya`)
      }
      await notifyAdmin(lines.join('\n').slice(0, 1900))
    }

    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)
    console.error('[cron/pine-lab]', e)
    await notifyAdmin(`🚨 Pine Lab · ${wibStamp()} WIB — siklus error internal: ${msg}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
