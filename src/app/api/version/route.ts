import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.7'
const NOTES = 'CHART GANTI TRADINGVIEW RESMI (direktif Bos): chart default kini widget Advanced Chart resmi TradingView (tv.js) — data feed langsung dari server TradingView (OANDA/FX/NASDAQ/BINANCE) di browser utk XAU, GBPUSD, dst; rantai data server dibalik TradingView dulu; fix 422 Yahoo (period1 tepat batas 60 hari); Vela Lab jadi mode lanjutan utk Pine Script & garis alert.'

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
