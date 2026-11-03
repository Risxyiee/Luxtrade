/**
 * ============================================================
 * pine-alert-runner — Mesin alert otomatis 24 jam (Task 44)
 * ============================================================
 * Dipakai DUA route (logika identik, tidak ada duplikasi):
 *   - /api/cron/pine-alerts   → GitHub Actions tiap 5 menit (batch
 *     semua langganan aktif — alert jalan walau chart tidak dibuka)
 *   - /api/pine/alerts/test   → tombol "Aktifkan + test" di UI
 *     (evaluasi langsung 1 grup untuk 1 user)
 *
 * Alur per grup (script, symbol, timeframe):
 *   1. fetchServerCandles (TradingView → TwelveData → Yahoo, keyless)
 *   2. runPineHeadless    (source TIDAK pernah keluar dari server)
 *   3. Kumpulkan pemicu: event engine alert() + alert_rules declaratif
 *      pada JENDELA CATCH-UP (beberapa bar terakhir — cron bisa telat;
 *      FIX "ada sinyal tapi diem aja": dulu HANYA bar terakhir, sinyal
 *      yang terjadi 1 bar saja sebelum cron tick tidak pernah terkirim)
 *   4. Dedupe per-bar via pine_alert_log (unique index) + mem map
 *   5. PUSH layar HP gaya WhatsApp (push-notify.ts) — sinyal muncul
 *      otomatis di tray notifikasi HP walau app tertutup.
 *      (Jalur chat Telegram DIHAPUS — bot token revoked.)
 *
 * File ini WAJIB hanya diimpor dari server (API route).
 */

import {
  runPineHeadless, runDefaultStrategyPine, evaluateAlertRules,
  fetchServerCandles,
  type AlertRule, type PlotSeries,
} from '@/lib/pine-protected'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { pushToUser, signalEmoji } from '@/lib/push-notify'
import { DEFAULT_PINE_SLUG } from '@/lib/pine-default-meta'

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

export interface AlertTrigger {
  signal: string
  message: string
  time: number // epoch detik (open time bar pemicu)
  price: number
}

export interface RunnerOutcome {
  ok: boolean
  error?: string
  candleSource?: string
  triggers: AlertTrigger[]
  sent: number
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
   Kumpulkan pemicu — JENDELA CATCH-UP (default 6 bar terakhir).
   Dulu HANYA bar terakhir → sinyal yang muncul sesaat sebelum cron
   tick (atau saat candle source belum memuat bar berjalan) hilang
   senyap selamanya. Sekarang event (alert()/entry/SL/TP/cross)
   dicari dalam jendela; kirim-ganda dicegah dedupe DB per-bar
   (pine_alert_log unique) + memDedupe 5 menit.
   ============================================================ */
export const ALERT_LOOKBACK_BARS = 6

export function collectTriggers(opts: {
  engineAlerts: Array<{ message: string; time: number; barIndex: number }>
  rules: AlertRule[] | null | undefined
  plots: PlotSeries[]
  bars: Array<{ time: number; close: number }>
  lookbackBars?: number
}): AlertTrigger[] {
  const { engineAlerts, rules, plots, bars } = opts
  const lookback = Math.max(1, opts.lookbackBars ?? ALERT_LOOKBACK_BARS)
  const triggers: AlertTrigger[] = []
  if (!bars.length) return triggers
  const lastBar = bars[bars.length - 1]
  const cutoffSec = bars[Math.max(0, bars.length - lookback)].time

  /* a) Sinyal dari event engine (alert() / trade entry-exit) —
     semua event dalam jendela catch-up */
  for (const a of engineAlerts) {
    const barSec = Number(a.barIndex) >= 0 && bars[a.barIndex] ? bars[a.barIndex].time : Math.floor(a.time / 1000)
    if (barSec < cutoffSec) continue // di luar jendela → abaikan
    const msg = String(a.message || 'Sinyal indikator')
    const sig = /TP|TAKE.?PROFIT/i.test(msg) ? 'TAKE_PROFIT'
      : /SL|STOP.?LOSS/i.test(msg) ? 'STOP_LOSS'
      : /BUY|LONG|BULL/i.test(msg) ? 'ENTRY_LONG'
      : /SELL|SHORT|BEAR/i.test(msg) ? 'ENTRY_SHORT' : 'SIGNAL'
    triggers.push({ signal: sig, message: msg, time: barSec, price: bars[a.barIndex]?.close ?? lastBar.close })
  }

  /* b) Sinyal dari alert_rules declaratif (skrip tanpa alert()) —
     cross = event (jendela), above/below = state (bar terakhir) */
  triggers.push(...evaluateAlertRules(rules, plots, bars, lookback))
  return triggers
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
  const writeLog = opts?.writeLog !== false
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
     Skrip DEFAULT (Luxtradee Candle Impulsif) dieksekusi lewat
     REPLIKA TypeScript (tanpa eval — Cloudflare Workers melarang
     kodegen; engine PineTS selalu 422 di produksi). */
  const run = script.slug === DEFAULT_PINE_SLUG
    ? await runDefaultStrategyPine(symbol, interval, cd.bars)
    : await runPineHeadless(script.source, symbol, interval, cd.bars)
  if (!run.ok || !run.plots?.length) {
    outcome.error = run.error || 'Skrip tidak menghasilkan plot'
    return outcome
  }
  outcome.ok = true

  /* 3) Pemicu bar terakhir */
  outcome.triggers = collectTriggers({
    engineAlerts: run.engineAlerts || [],
    rules: script.alert_rules,
    plots: run.plots,
    bars: cd.bars,
  })
  if (!outcome.triggers.length || !send) return outcome

  /* 4+5) Dedupe per-bar → push layar HP */
  const supabase = getSupabaseAdmin()
  outcome.perUser = []
  for (const u of users) {
    let sentThis = false
    let reason = 'server belum terhubung'
    for (const t of outcome.triggers) {
      /* Watermark langganan: jangan replay sinyal sebelum user aktifasi
         (cron memakai created_at langganan; tes manual tanpa watermark) */
      if (u.sinceSec && t.time < u.sinceSec) { reason = 'sinyal sebelum langganan aktif'; continue }
      const memKey = `${u.userId}:${script.id}:${symbol}:${t.signal}:${t.time}`
      if (!memDedupeOk(memKey)) { reason = 'dedupe 5 menit'; continue }

      let isNew = true
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
        }
      }
      if (!isNew) { reason = 'sudah terkirim di bar ini'; continue }

      /* ── Push layar HP — tampil otomatis walau app tertutup.
         Dedupe bar sudah dijaga pine_alert_log di atas → dedupe:false. */
      if (supabase) {
        const push = await pushToUser(supabase, u.userId, {
          title: `${signalEmoji(t.signal)} ${t.signal.toUpperCase()} — ${symbol} ${interval}`,
          body: `${script.name}${t.price ? ` · Harga ~${t.price}` : ''}`,
          tag: `pine-${script.id}-${symbol}-${t.signal}`,
          type: 'trade',
          url: '/dashboard',
          urgency: 'high',
        }, { dedupe: false })
        /* Sukses = push layar HP gaya WA terkirim ke minimal 1 device. */
        if (push.sent > 0) {
          outcome.sent++; sentThis = true; reason = ''
        } else if (push.skipped === 'no-subs') {
          reason = 'notifikasi belum diaktifkan (izinkan notifikasi di dashboard)'
        } else {
          reason = push.error || (push.skipped === 'dedupe' ? 'dedupe' : 'push gagal')
        }
      }
    }
    outcome.perUser.push({ userId: u.userId, ok: sentThis, reason: sentThis ? undefined : reason })
  }
  return outcome
}
