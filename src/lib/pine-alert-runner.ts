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
 *   3. Kumpulkan pemicu: event engine alert() pada bar terakhir
 *      + alert_rules declaratif (cross_above/cross_below/above/below)
 *   4. Dedupe per-bar via pine_alert_log (unique index) + mem map
 *   5. sendTelegramToUser (chat_id dari profiles)
 *
 * File ini WAJIB hanya diimpor dari server (API route).
 */

import {
  runPineHeadless, evaluateAlertRules, sendTelegramToUser, formatSignalMessage,
  fetchServerCandles,
  type AlertRule, type PlotSeries,
} from '@/lib/pine-protected'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export interface RunnerScript {
  id: string
  name: string
  source: string
  alert_rules: AlertRule[] | null
}

export interface RunnerUser {
  userId: string
  chatId: string
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
   Kumpulkan pemicu — logika identik dengan detectAndDispatch
   compile-pine: engine alert() hanya bar TERAKHIR (anti spam)
   + evaluateAlertRules declaratif.
   ============================================================ */
export function collectTriggers(opts: {
  engineAlerts: Array<{ message: string; time: number; barIndex: number }>
  rules: AlertRule[] | null | undefined
  plots: PlotSeries[]
  bars: Array<{ time: number; close: number }>
}): AlertTrigger[] {
  const { engineAlerts, rules, plots, bars } = opts
  const triggers: AlertTrigger[] = []
  if (!bars.length) return triggers
  const lastBar = bars[bars.length - 1]
  const lastTimeSec = lastBar.time

  /* a) Sinyal dari event engine (script memakai alert()) — hanya bar terakhir */
  for (const a of engineAlerts) {
    const barSec = Number(a.barIndex) >= 0 && bars[a.barIndex] ? bars[a.barIndex].time : Math.floor(a.time / 1000)
    if (barSec !== lastTimeSec) continue // historis → abaikan
    const msg = String(a.message || 'Sinyal indikator')
    const sig = /TP|TAKE.?PROFIT/i.test(msg) ? 'TAKE_PROFIT'
      : /SL|STOP.?LOSS/i.test(msg) ? 'STOP_LOSS'
      : /BUY|LONG|BULL/i.test(msg) ? 'ENTRY_LONG'
      : /SELL|SHORT|BEAR/i.test(msg) ? 'ENTRY_SHORT' : 'SIGNAL'
    triggers.push({ signal: sig, message: msg, time: lastTimeSec, price: lastBar.close })
  }

  /* b) Sinyal dari alert_rules declaratif (skrip tanpa alert()) */
  triggers.push(...evaluateAlertRules(rules, plots, bars))
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

  /* 2) Headless run — source tetap di server */
  const run = await runPineHeadless(script.source, symbol, interval, cd.bars)
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

  /* 4+5) Dedupe per-bar → Telegram */
  const supabase = getSupabaseAdmin()
  outcome.perUser = []
  for (const u of users) {
    if (!u.chatId) { outcome.perUser.push({ userId: u.userId, ok: false, reason: 'telegram belum terhubung' }); continue }
    let sentThis = false
    let reason = ''
    for (const t of outcome.triggers) {
      const memKey = `${u.userId}:${script.id}:${symbol}:${t.signal}:${t.time}`
      if (!memDedupeOk(memKey)) { reason = 'dedupe 5 menit'; continue }

      let isNew = true
      if (supabase && writeLog) {
        const { data: ins, error: logErr } = await supabase
          .from('pine_alert_log')
          .insert({
            user_id: u.userId, script_id: script.id, symbol,
            signal_type: t.signal, bar_time: new Date(t.time * 1000).toISOString(),
            price: t.price,
          })
          .select('id')
          .ignoreDuplicates()
        if (logErr) {
          console.error('[pine-alert-runner] log gagal (tabel ada?):', logErr.message)
          /* tabel belum dibuat → tetap kirim, hanya 1× per 5 menit (memDedupe) */
        } else if (Array.isArray(ins) && ins.length === 0) {
          isNew = false // sudah terkirim utk bar ini
        }
      }
      if (!isNew) { reason = 'sudah terkirim di bar ini'; continue }

      const html = formatSignalMessage({
        scriptName: script.name, symbol, interval,
        signal: t.signal, price: t.price, barTimeSec: t.time,
        extra: t.message && t.message !== t.signal ? `💬 ${t.message}` : undefined,
      })
      const okTg = await sendTelegramToUser(u.chatId, html)
      if (okTg) { outcome.sent++; sentThis = true }
      else reason = 'gagal kirim Telegram'
    }
    outcome.perUser.push({ userId: u.userId, ok: sentThis, reason: sentThis ? undefined : reason })
  }
  return outcome
}
