import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-12.2'
const NOTES = 'PINE SIGNALS EDGE-READY + LICENSE AGPL-3.0: (1) backtest & chart di Cloudflare Workers kini jalan penuh — server tanpa worker_threads otomatis meneruskan eksekusi ke BROWSER via Web Worker browser-worker.mjs (build browser PineTS: plots, trade broker, marker sinyal tetap tampil; toast memberi tahu mode browser); (2) validasi di edge tidak lagi memblokir simpan script (dry-run dilewati + warning, validasi statis tetap jalan); (3) inline fallback runPine (tanpa plots) untuk live-run di runtime tanpa worker; (4) template Champion v6 di-bundle sebagai konstanta (edge-safe, tidak lagi 404 di CF); (5) LICENSE AGPL-3.0 resmi + README License section (keputusan Bos: pakai PineTS via AGPL, repo tetap publik, bebas biaya); (6) SQL supabase/migrations/20261112_pine_signals.sql tetap dieksekusi manual Bos. Batasan: cron live alert masih butuh runner Node/Bun eksternal. Versi sebelumnya: 11.12.1 = fitur Pine Signals awal; 11.18 = fix kantor CEO kosong (three.js flat helper).'

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
