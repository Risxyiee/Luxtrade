/**
 * ============================================================
 * pine-protected — Protected Custom Pine Script® (server-side)
 * ============================================================
 * ATURAN KEAMANAN (keinginan Bos, Task 41):
 *   1. Source Pine master script TIDAK PERNAH dikirim ke browser.
 *   2. Script master disimpan di tabel `protected_scripts`
 *      (Supabase, RLS tanpa policy → hanya service role).
 *   3. Server menjalankan engine PineTS (yang sama dengan chart)
 *      secara HEADLESS terhadap candle server (TradingView →
 *      TwelveData → Yahoo — keyless, tanpa API key),
 *      lalu HANYA mengembalikan hasil plot {time, value} + sinyal.
 *   4. Alert Entry/SL/TP terdeteksi server (event `alert()` engine
 *      + alert_rules declaratif), di-dedupe per-bar, lalu diteruskan
 *      sebagai push notifikasi layar HP user Pro.
 *
 * ARSITEKTUR EKSEKUSI (fix "alert pine user tidak jalan di produksi"):
 *   Engine PineTS memakai `new Function` (code generation) — DILARANG
 *   runtime Cloudflare Workers (workerd) → EvalError di produksi.
 *   Semua fungsi engine MURNI pindah ke `pine-engine-core.ts` (bebas
 *   dep berat) supaya bisa diimpor DUA runtime:
 *     - Worker CF: replika TS default (runDefaultStrategyPine) jalan.
 *     - GitHub Actions runner (scripts/pine-alerts-engine.ts): engine
 *       PineTS penuh jalan — jalur resmi alert Pine user & protected.
 *
 * File ini WAJIB hanya diimpor dari server (API route).
 */

import { runDefaultStrategy } from '@/lib/pine-default-runner'
import { synthesizeTradePlots } from '@/lib/pine-engine-core'
import type { PineRunResult } from '@/lib/pine-engine-core'

/* Re-export dari pine-engine-core — API lama tetap stabil untuk
   semua pemakai lama (pine-alert-runner, compile-pine, test). */
export type { PlotSeries, PineRunResult, AlertRule, AlertTrigger } from '@/lib/pine-engine-core'
export {
  runPineHeadless,
  evaluateAlertRules,
  collectTriggers,
  scanPlotColors,
  synthesizeTradePlots,
  ALERT_LOOKBACK_BARS,
} from '@/lib/pine-engine-core'

/**
 * Jalankan REPLIKA TypeScript strategy default (Luxtradee Candle
 * Impulsif) — jalur EKSEKUSI resmi untuk skrip default di produksi.
 * Engine PineTS tidak bisa jalan di Cloudflare Workers (eval dilarang
 * → "Code generation from strings disallowed"), jadi skrip default
 * dieksekusi lewat replika TS 100% tanpa eval (logika identik —
 * lihat pine-default-runner.ts). Source Pine verbatim tetap tersimpan
 * di protected_scripts / DEFAULT_PINE_SOURCE (tidak pernah ke browser).
 */
export async function runDefaultStrategyPine(
  _symbol: string,
  _timeframe: string,
  barsSec: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>,
): Promise<PineRunResult> {
  if (!barsSec.length) return { ok: false, error: 'Tidak ada candle untuk dieksekusi' }
  const { trades, engineAlerts, stats } = runDefaultStrategy(
    barsSec.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })),
  )
  const barsMs = barsSec.map((b) => ({ ...b, time: b.time * 1000 }))
  const plots = synthesizeTradePlots(barsMs, trades)
  /* Trade mentah → visual chart ala line.new/label.new Pine Bos
     (client menggambar: garis entry→exit dotted hijau/merah + label
     TP/SL + panah BUY/SELL). Posisi terbuka → exit null. */
  const tradesPayload = trades.map((t) => ({
    side: t.side,
    entryTime: Number(t.entry?.time) || 0,
    entryPrice: Number(t.entry?.price) || 0,
    exitTime: t.exit?.time != null ? Number(t.exit.time) : null,
    exitPrice: t.exit?.price != null ? Number(t.exit.price) : null,
    pnl: Number(t.pnl) || 0,
    reason: t.reason,
  }))
  /* Tabel performa ala TradingView (Bos: indikator luxtrade harus
     kelihatan sebagai script master dia — Net P&L s.d. status). */
  const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`
  const pct = (v: number) => `${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(2)}%`
  const dayFmt = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' })
  const statsPayload: Record<string, string | number | boolean | null> = {
    netProfit: `${money(stats.netProfit)} (${pct(stats.netPct)})`,
    trades: `${stats.closedTrades} / ${stats.winRate.toFixed(1)}%`,
    profitFactor: stats.profitFactor == null ? '-' : stats.profitFactor.toFixed(2),
    streaks: `${stats.maxLossStreak} / ${stats.maxWinStreak}`,
    dailyDD: `${money(stats.maxDailyDD)} (${stats.maxDailyDDPct.toFixed(2)}%)`,
    overallDD: `${money(stats.maxOverallDD)} (${stats.maxOverallDDPct.toFixed(2)}%)`,
    testStart: stats.testStartMs ? dayFmt.format(new Date(stats.testStartMs)) : '-',
    firstTrade: stats.firstTradeTimeMs ? dayFmt.format(new Date(stats.firstTradeTimeMs)) : '-',
    openPos: stats.openPos,
    paused: stats.paused,
  }
  return { ok: true, title: 'Luxtradee Candle Impulsif', overlay: true, plots, trades: tradesPayload, engineAlerts, stats: statsPayload }
}

/* ============================================================
   KIRIM SINYAL — via push layar HP (push-notify.ts di runner).
   Jalur Telegram dihapus — riwayat git menyimpan versi lama.
   ============================================================ */

/* Re-export agar route tidak impor dua lib */
export { fetchServerCandles, intervalSeconds } from '@/lib/market/server-candles'
