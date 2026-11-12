import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.14'
const NOTES = 'ALERT STRATEGI v2.1 — TAMBAH KONDISI BREAKOUT MOMENTUM (MOM_BRK_UP/DN, terjemahan 1:1 strategi H1 PRIBADI Bos — nama dineutralkan, file Pine TIDAK disimpan di repo): lib/market/indicators.ts += ta.dmi (Wilder: +DI/-DI/ADX), ta.pivothigh/ta.pivotlow (fractal non-repainting, konfirmasi len bar kanan), filter sesi WIB Asia/Jakarta (jam BAR), evaluator konfluensi: candle searah + body >= X% range + close tembus max(high[1..2])/min(low[1..2]) + ADX >= min + DI searah + tembus fractal + di sesi; kolom baru strategy_alerts: body_min_pct/adx_len/adx_smooth/adx_min/fractal_len/use_fractal/sess_start/sess_end/tz_name (SQL idempotent ditulis ulang); cron fetchCandles kini OHLC penuh + cabang MOM_BRK ke evalMomentumBreakout; API validasi param baru; modal UI: 2 pilihan breakout + form 7 parameter (body%, ADX min, DI len, smoothing, fractal, sesi mulai/selesai). Notif berisi body%, ADX, fractal, level retest (open sinyal). Versi sebelumnya: 11.13 = alert strategi/indikator ala Pine v2 (RSI/EMA/MACD, 8 kondisi) LIVE.'

export async function GET() {
  return NextResponse.json(
    {
      version: VERSION,
      notes: NOTES,
      time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
