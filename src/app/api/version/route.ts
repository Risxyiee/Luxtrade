import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.8'
const NOTES = 'YAHOO FINANCE DIHAPUS TOTAL (direktif Bos: "data lain yahoo finance hapus aja") — file lib/market/yahoo.ts dihapus; rantai data murni TradingView -> TwelveData (+gold-api/binance utk tick spot) di /api/candles, /api/forex, /api/forex-batch, server-candles (Pine), overlay spot & AI chat; cache KV v10 buang entri skala futures lama. FIX IG: window konten karyawan dibuka sampai 20:59 WIB agar jaring pengaman cron 20:30 benar-benar memposting Reels/konten Sinta yang tertahan.'

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
