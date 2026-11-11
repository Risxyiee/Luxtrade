import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.11'
const NOTES = 'FINAL CHART 100% TRADINGVIEW + JALUR GRATIS (Bos 11-11): (1) konsep dikonfirmasi — chart & semua elemen chart kini widget resmi TradingView (tv.js, awesome-tradingview): data feed ditarik LANGSUNG server TradingView di browser user → GRATIS, tanpa API key, tanpa kuota, tanpa makan CPU Cloudflare; XAUUSD/GBPUSD/forex/gold real-time gratis di TradingView; (2) webhook/alert TradingView TIDAK dipakai (itu berbayar, minimal Essential ±$13/bln, dan alert harus dibuat manual satu-satu di chart) — kembali jalur 100% gratis; (3) BERSIH-BERSIH KODE HANTU chart lama: CandlestickChart.tsx, LuxtradeMiniChart.tsx, wrapper DynamicCharts.tsx (nol pemakai) DIHAPUS TOTAL + dependency lightweight-charts dicopot dari package.json & bun.lock disinkronkan → chart lama tidak mungkin balik lewat revert (kasus "file hantu" dulu); (4) verifikasi: lint bersih, dev compile OK, landing produksi terbukti merender chart XAUUSD OANDA live dari TradingView (screenshot Agent Browser), auth wall /dashboard/chart benar redirect login.'

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
