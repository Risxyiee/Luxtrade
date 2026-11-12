import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-12.3'
const NOTES = 'PINE DINONAKTIFKAN SEMENTARA (Bos: "untuk marketing dan promosi pine di website semuanya dihapus dulu, biarin chart di websiteku kek gitu, alert pine hapus aja dulu" — Bos mau coba Pine sendiri dulu): (1) tab Pine Signals + menu sidebar DIHAPUS dari dashboard; (2) tombol "Buat Alert" + AlertCreatorModal (alert ala Pine: RSI/EMA/MACD) DIHAPUS dari Chart — chart TradingView 100% UTUH, tidak tersentuh; (3) seluruh API pine (/api/pine/*) + alert strategi (/api/strategy-alerts + cron 5-menitnya) DIHAPUS dari worker-entry & patch-cf-worker-cron; (4) engine src/lib/pine + script test + 2 migrasi SQL pine dihapus (semua bisa dipulihkan dari git saat Bos mau aktifkan lagi); (5) landing dibersihkan dari promosi Pine (bullet "alert ala Pine" + klaim hemat TradingView + FAQ Elite Pro); (6) fitur TETAP HIDUP: chart TradingView, price alert via Watchlist (cron /api/cron/price-alerts 15-menit), semua tab lain. Versi sebelumnya: 11.12.2 = Pine Signals edge-ready + LICENSE AGPL-3.0; 11.12.1 = fitur Pine Signals awal.'

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
