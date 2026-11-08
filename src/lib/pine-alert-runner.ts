/**
 * ============================================================
 * pine-alert-runner — Mesin alert otomatis 24 jam (Task 44)
 * ============================================================
 * Dipakai TIGA jalur (logika identik, tidak ada duplikasi):
 *   - /api/cron/pine-alerts       → cron Cloudflare 15 menit (BACKUP;
 *     engine PineTS TIDAK bisa jalan di workerd — grup Pine
 *     ditandai engineDeferred, bukan error)
 *   - /api/cron/pine-alerts/payload + /report → GitHub Actions
 *     runner Node penuh (JALUR UTAMA — engine PineTS jalan normal,
 *     eval diizinkan di runner; lihat scripts/pine-alerts-engine.ts)
 *   - /api/pine/alerts/test       → tombol "Aktifkan + test" di UI
 *     (evaluasi langsung 1 grup untuk 1 user)
 *
 * Alur per grup (script, symbol, timeframe):
 *   1. fetchServerCandles (TradingView → TwelveData → Yahoo, keyless)
 *   2. runPineHeadless    (source TIDAK pernah keluar dari server)
 *   3. Kumpulkan pemicu: event engine alert() + alert_rules declaratif
 *      pada JENDELA CATCH-UP (beberapa bar terakhir — cron bisa telat)
 *   4. Dedupe per-bar via pine_alert_log (unique index) + mem map
 *   5. PUSH layar HP gaya WhatsApp (push-notify.ts) — sinyal muncul
 *      otomatis di tray notifikasi HP walau app tertutup.
 *      (Jalur chat Telegram DIHAPUS — bot token revoked.)
 *
 * File ini WAJIB hanya diimpor dari server (API route).
 */

import {
  runPineHeadless, collectTriggers, ALERT_LOOKBACK_BARS,
  type AlertRule, type PlotSeries, type AlertTrigger,
} from '@/lib/pine-engine-core'
import { fetchServerCandles } from '@/lib/market/server-candles'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { pushToUser, signalEmoji } from '@/lib/push-notify'
import { isXauLikeSymbol, isXauMarketOpen } from '@/lib/market-hours'

/* Kompatibilitas API lama (modul lain impor dari runner) */
export { collectTriggers, evaluateAlertRules, ALERT_LOOKBACK_BARS } from '@/lib/pine-engine-core'
export type { AlertTrigger } from '@/lib/pine-engine-core'

export interface RunnerScript {
  id: string
  slug?: string
  name: string
  source: string
  alert_rules: AlertRule[] | null
}

export interface RunnerUser {
  userId: string
  /** Watermark anti-replay: epoch DETIK — sinyal lebih tua dari ini
      dilewati (dipakai cron dari pine_alert_subscriptions.created_at
      supaya langganan BARU tidak membanjiri sinyal historis). */
  sinceSec?: number
}

export interface RunnerOutcome {
  ok: boolean
  error?: string
  candleSource?: string
  triggers: AlertTrigger[]
  sent: number
  /** true = grup butuh engine PineTS yang tidak bisa jalan di runtime
      ini (workerd melarang codegen) — DITANGANI GHA RUNNER, bukan error */
  engineDeferred?: boolean
  perUser?: Array<{ userId: string; ok: boolean; reason?: string }>
}

/* ============================================================
   Normalisasi input dari UI / langganan
   ============================================================ */

/* Vela timeframe kanonik → interval server (sama dengan /api/compile-pine) */
const TF_NORMALIZE: Record<string, string> = {
  '5': '5m', '15': '15m', '30': '30m', '60': '1h', '120': '2h', '240': '4h',
  '1D': '1d', 'D': '1d', '1440': '1d', '1W': '1w', 'W': '1w', '10080': '1w',
}

/** Interval kanonik yang diterima fetchServerCandles */
export const PINE_INTERVALS = ['5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'] as const

export function normalizePineInterval(tf: string): string {
  const t = String(tf || '').trim()
  if (TF_NORMALIZE[t]) return TF_NORMALIZE[t]
  if (/^\d+m$|^\d+h$|^1d$|^1w$/.test(t)) return t
  return '1h'
}

/** Simbol longgar tapi bersih: XAUUSD, BTCUSDT, US100, NQ=F, EUR/USD */
export function sanitizeSymbol(raw: string): string {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9=/.\-]/g, '').slice(0, 16)
}

/* Error khas runtime tanpa codegen (workerd/CF produksi) */
const CODEGEN_ERROR_RE = /code generation|disallowed for this context|evalerror/i

/* ============================================================
   KESEHATAN EVALUASI (migrasi 044) — BUKTI nyata "skrip beneran
   jalan": tiap verdict runner (GHA/cron CF/tombol tes) disimpan
   ke langganan grup (script, symbol, timeframe) supaya UI bisa
   menampilkan kapan terakhir dievaluasi + ok/error engine.
   Resilient: kolom belum ada (migrasi belum dijalankan) → diabaikan
   diam (pola last_trigger_at).
   ============================================================ */
export async function persistEvalHealth(
  supabase: any,
  g: { scriptId: string; symbol: string; interval: string },
  verdict: { ok: boolean; error?: string },
): Promise<void> {
  if (!supabase) return
  try {
    await supabase
      .from('pine_alert_subscriptions')
      .update({
        last_eval_at: new Date().toISOString(),
        last_eval_ok: verdict.ok,
        last_eval_error: verdict.ok ? null : String(verdict.error || 'evaluasi gagal').slice(0, 300),
      })
      .eq('script_id', g.scriptId)
      .eq('symbol', g.symbol)
      .eq('timeframe', g.interval)
      .eq('enabled', true)
  } catch { /* dekoratif — jangan pernah gagalkan run */ }
}

/* ============================================================
   Dedupe lapis-1 in-memory (per isolat) — cadangan bila tabel
   pine_alert_log belum ada / error. Sama pola dengan compile-pine.
   ============================================================ */
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

/* ============================================================
   KIRIM SINYAL ke daftar user — dipakai cron CF, report GHA,
   dan tombol tes. (Diekstrak dari runAlertGroup supaya jalur
   GHA report tidak duplikasi logika dedupe+push.)
   ============================================================ */
export async function sendAlertTriggers(
  script: { id: string; name: string },
  symbol: string,
  interval: string,
  users: RunnerUser[],
  triggers: AlertTrigger[],
  opts?: { writeLog?: boolean },
): Promise<{ sent: number; perUser: Array<{ userId: string; ok: boolean; reason?: string }> }> {
  const writeLog = opts?.writeLog !== false
  const supabase = getSupabaseAdmin()
  const perUser: Array<{ userId: string; ok: boolean; reason?: string }> = []
  let sent = 0

  if (!triggers.length || !users.length) return { sent, perUser }

  /* GERBANG PASAR TUTUP (keluhan Bos 8 Nov 2026, Minggu: "pine script
     masih kirim notif XAU padahal pasar tutup"). Evaluasi tetap jalan
     (kesehatan skrip tetap terpantau), claim dedupe tetap ditulis —
     sinyal basi bar Jumat TIDAK di-replay Senin saat buka — hanya
     PUSH-nya yang ditahan. Jadwal = KALENDER New York, tidak bisa
     dibodohi timestamp upstream yang beku di weekend. */
  const marketOpen = !isXauLikeSymbol(symbol) || isXauMarketOpen()

  for (const u of users) {
    let sentThis = false
    let reason = 'server belum terhubung'
    for (const t of triggers) {
      /* Watermark langganan: jangan replay sinyal sebelum user aktifasi
         (cron memakai created_at langganan; tes manual tanpa watermark) */
      if (u.sinceSec && t.time < u.sinceSec) { reason = 'sinyal sebelum langganan aktif'; continue }
      const memKey = `${u.userId}:${script.id}:${symbol}:${t.signal}:${t.time}`
      if (!memDedupeOk(memKey)) { reason = 'dedupe 5 menit'; continue }

      let isNew = true
      let claimedRowId: string | null = null
      if (supabase && writeLog) {
        const { data: ins, error: logErr } = await supabase
          .from('pine_alert_log')
          .upsert(
            {
              user_id: u.userId, script_id: script.id, symbol,
              signal_type: t.signal, bar_time: new Date(t.time * 1000).toISOString(),
              price: t.price,
            },
            {
              // MIGRASI 020: unique index (user_id, script_id, symbol, signal_type,
              // bar_time) → duplikat di-ignore DB → 0 baris balik = isNew false.
              // SEBELUM SQL 020 dijalankan: PostgREST balik 42P10 → masuk branch
              // logErr → alert tetap terkirim (proteksi memDedupe 5 menit) — aman.
              onConflict: 'user_id,script_id,symbol,signal_type,bar_time',
              ignoreDuplicates: true,
            }
          )
          .select('id')
        if (logErr) {
          console.error('[pine-alert-runner] log gagal (index 020 sudah dijalankan?):', logErr.message)
          /* index unique belum ada → tetap kirim, hanya 1× per 5 menit (memDedupe) */
        } else if (Array.isArray(ins) && ins.length === 0) {
          isNew = false // sudah terkirim utk bar ini (dedupe DB beneran)
        } else if (Array.isArray(ins) && ins.length > 0) {
          claimedRowId = String((ins[0] as any)?.id || '') || null
        }
      }
      if (!isNew) { reason = 'sudah terkirim di bar ini'; continue }

      /* Pasar tutup → notifikasi DITAHAN (claim dedupe sudah ditulis di
         atas — bar ini tidak akan menembak ulang). Lihat catatan di
         atas (const marketOpen). */
      if (!marketOpen) {
        reason = 'pasar tutup (weekend/jeda harian) — notifikasi ditahan'
        continue
      }

      /* ── Push layar HP — tampil otomatis walau app tertutup.
         Dedupe bar sudah dijaga pine_alert_log di atas → dedupe:false.
         FIX "sinyalnya bukan dari pine saya": JUDUL sekarang memuat
         NAMA SKRIP sumbernya (bukan cuma label generik) dan ISI memuat
         PESAN ASLI skrip (t.message dari alert()/strategy engine) —
         user langsung tahu sinyal ini lahir dari skrip siapa. */
      if (supabase) {
        const push = await pushToUser(supabase, u.userId, {
          title: `${signalEmoji(t.signal)} ${t.signal.toUpperCase()} · ${script.name}`.slice(0, 90),
          body: `${symbol} ${interval}${t.price ? ` · ~${t.price}` : ''}${t.message && t.message.trim() && t.message.trim().toUpperCase() !== t.signal ? ` · ${t.message.trim().slice(0, 120)}` : ''}`,
          tag: `pine-${script.id}-${symbol}-${t.signal}`,
          type: 'trade',
          url: '/dashboard',
          urgency: 'high',
        }, { dedupe: false })
        /* Sukses = push layar HP gaya WA terkirim ke minimal 1 device. */
        if (push.sent > 0) {
          sent++; sentThis = true; reason = ''
        } else if (push.skipped === 'no-subs') {
          reason = 'notifikasi belum diaktifkan (izinkan notifikasi di dashboard)'
        } else {
          reason = push.error || (push.skipped === 'dedupe' ? 'dedupe' : 'push gagal')
        }
        /* FIX "sinyal hilang permanen": dulu baris log di-INSERT SEBELUM
           push — push gagal (device belum izinkan notif, dsb.) → bar ini
           selamanya dianggap "sudah terkirim". Sekarang: claim dibatalkan
           agar run berikutnya retry. */
        if (!sentThis && claimedRowId) {
          try { await supabase.from('pine_alert_log').delete().eq('id', claimedRowId) } catch { /* best effort */ }
        }
      }
    }
    perUser.push({ userId: u.userId, ok: sentThis, reason: sentThis ? undefined : reason })
  }
  return { sent, perUser }
}

/* ============================================================
   Jalankan satu grup (script, symbol, timeframe) untuk N user
   ============================================================ */
export async function runAlertGroup(
  script: RunnerScript,
  symbol: string,
  interval: string,
  users: RunnerUser[],
  opts?: { send?: boolean; writeLog?: boolean },
): Promise<RunnerOutcome> {
  const send = opts?.send !== false
  const outcome: RunnerOutcome = { ok: false, triggers: [], sent: 0 }

  if (!users.length) { outcome.ok = true; return outcome }

  /* 1) Candle server (TradingView → TwelveData → Yahoo — keyless) */
  const cd = await fetchServerCandles(symbol, interval, 300)
  if (!cd || !cd.bars.length) {
    outcome.error = `Data candle ${symbol} ${interval} tidak tersedia dari semua sumber server`
    return outcome
  }
  outcome.candleSource = cd.source

  /* 2) Headless run — source tetap di server.
     CATATAN RUNTIME: engine PineTS memakai `new Function` (codegen)
     — DILARANG di Cloudflare Workers produksi (EvalError). Skrip
     yang butuh engine ditandai engineDeferred → ditangani GHA
     runner (scripts/pine-alerts-engine.ts, Node penuh). */
  const run = await runPineHeadless(script.source, symbol, interval, cd.bars)
  if (!run.ok || !run.plots?.length) {
    const raw = run.error || 'Skrip tidak menghasilkan plot'
    if (CODEGEN_ERROR_RE.test(raw)) {
      outcome.engineDeferred = true
      outcome.error = 'Engine Pine tidak bisa berjalan di runtime server produksi (batasan Cloudflare Workers: code generation dinonaktifkan). Alert kamu TETAP AKTIF — runner eksternal mengevaluasi skrip tiap ±5 menit dan push otomatis masuk layar HP begitu ada sinyal.'
    } else {
      outcome.error = raw
    }
    return outcome
  }
  outcome.ok = true

  /* 3) Pemicu bar terakhir (jendela catch-up 6 bar) */
  outcome.triggers = collectTriggers({
    engineAlerts: run.engineAlerts || [],
    rules: script.alert_rules,
    plots: run.plots,
    bars: cd.bars,
  })
  if (!outcome.triggers.length || !send) return outcome

  /* 4+5) Dedupe per-bar → push layar HP */
  const res = await sendAlertTriggers(script, symbol, interval, users, outcome.triggers, { writeLog: opts?.writeLog })
  outcome.sent = res.sent
  outcome.perUser = res.perUser
  return outcome
}
