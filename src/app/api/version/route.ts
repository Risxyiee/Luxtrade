import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.9'
const NOTES = 'VELA LAB DIHAPUS TOTAL + 100% TRADINGVIEW (direktif Bos: "vela lab hapus aja, ganti semuanya ke tradingview mulai dari pine alert dan gedein dikit chartnya"): (1) tab Chart kini murni widget resmi TradingView — mode Vela Lab/Pine editor/strategy tester dihapus, chart DIGEDEIN ke 85vh; (2) PINE ALERT diganti alert native TradingView (tombol "Buat Alert di TradingView" langsung ke chart simbol terpilih); (3) backend Pine dihapus semua: /api/pine/*, /api/compile-pine, /api/cron/pine-alerts (+ GHA pine-alerts-cron), engine pine-*, kuota edit pine, deps @luxalgo/vela*; (4) landing: PineAlertShowcase diganti TradingViewShowcase (chart XAUUSD live) + copy pricing/paywall/FAQ/CS dibersihkan dari Pine; (5) klik trade di tab Trades kini langsung buka chart TradingView; (6) probe health cron master-autonomous tidak lagi mengecek rute pine yang sudah tiada.'

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
