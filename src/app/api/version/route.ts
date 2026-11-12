import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-12.1'
const NOTES = 'FITUR PRO PINE SIGNALS: runtime Pine Script v5/v6 di server via PineTS (pinets) — user tempel script sendiri, validasi (statis+dry-run dengan nomor baris), backtest di candle H1 yang sudah close, event standar identik champion-signal.js (Uji A PASS 13 skenario × 3000 candle: PLACE/REPLACE/CANCEL EXPIRED+OUT_OF_SESSION, meta ADX 0 selisih), sandbox worker thread (timeout 5 dtk + loop guard + tanpa jaringan; Uji B/C/D PASS), idempotensi anti alert ganda (id = scriptId:candleTime:side:event), chart Lightweight Charts v5 (addSeries/CandlestickSeries + createSeriesMarkers + pane ADX + price line entry/SL/TP), alert push/Telegram/webhook, SQL supabase/migrations/20261112_pine_signals.sql (dieksekusi manual Bos). Catatan runtime: eksekusi Pine butuh Node/Bun (worker_threads) — di CF Workers edge API memberi pesan jelas. Versi sebelumnya: 11.18 = fix kantor CEO kosong (three.js flat helper).'

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
