import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.13'
const NOTES = 'ALERT STRATEGI & INDIKATOR ALA PINE v2 (Bos 11-11: "alert strategi dan indikator yang kita pasang... alertnya lewat fitur luxtradee sendiri, cuma numpang di chart tradingview untuk visualnya aja"): (1) LIB INDIKATOR SERVER lib/market/indicators.ts — terjemahan Pine ta.ema/ta.rsi(Wilder)/ta.macd(12,26,9) + evaluator 8 kondisi: RSI_ABOVE/BELOW, EMA_CROSS_UP/DOWN, PRICE_X_EMA_ABOVE/BELOW, MACD_CROSS_UP/DOWN; (2) TABEL strategy_alerts (SQL 20261111: kondisi+timeframe+dedupe last_bar_time "Once Per Bar"+RLS user); (3) CRON /api/cron/strategy-alerts — numpang slot */15 JALUR CEPAT (timeout 90dtk): group per (symbol,timeframe) cap 30 → 1 fetch candle 120-bar per group via /api/candles (rantai TradingView sama dgn chart user) → hitung indikator → web-push HP; guard pasar (XAU-like isXauMarketOpen, crypto 24/7) anti data beku weekend; (4) API /api/strategy-alerts CRUD (session Supabase + PRO check + kuota 20/user — TV Plus $29.95/bln cuma kasih 100 alert); (5) UI AlertCreatorModal 2 TAB: Harga (lama) + INDIKATOR ALA PINE (pilih kondisi+timeframe+param, daftar alert dgn toggle aktif/nonaktif); (6) LANDING showcase bullet jadi "Alert harga & indikator ala Pine — gratis". Pine user TETAP tak bisa dipasang di chart embed (batasan TradingView) tapi LOGIKANYA diterjemahkan server — file Pine Bos tinggal dipetakan ke 8 kondisi ini. Versi sebelumnya: 11.12 = alert harga + landing biru (LIVE).'

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
