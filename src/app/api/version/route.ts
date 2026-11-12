import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.15'
const NOTES = 'FIX CRON STRATEGY-ALERTS 500 + SLOT 5-MENIT (Bos: "cron strategi gagal 500" + "gabisa setiap 5 menit kah? 15 menit kelamaan"): (1) AKAR 500 = tabel belum ada → PostgREST balas PGRST205 "schema cache" (BUKAN 42P01) → deteksi lama meleset → 500 + alarm health-alert; kini PGRST205/42P01/pola "does not exist|schema cache|could not find the table" semua dilaporkan tenang (table_missing, bukan 500); (2) select(*) + kolom breakout dibaca defensif — cron kebal SQL versi lama (alert MOM pada skema lama dilewati sbg schemaOldSkipped, bukan crash); (3) SLOT */15 DIGANTI */5 di wrangler (jumlah trigger TETAP 4 — bukan slot baru, aman limit CF Free 5) — strategy-alerts KINI CEK TIAP 5 MENIT (permintaan Bos), econ-calendar/watchdog/price-alerts tetap 15 menit via EVERY_MIN (%15<5), jalur berat tetap giliran 15-menit (menit%15<5); (4) worker-entry: gagal cron kini mencatat ISI respons (300 char) ke log + payload health-alert — terdiagnosis bukan cuma angka; (5) patch-cf-worker-cron.mjs diselaraskan (hantu pine-alerts dibuang, arsitektur 5-menit + timeout strategy/price 90 dtk). Versi sebelumnya: 11.14 = kondisi breakout momentum (terjemahan strategi H1 Bos).'

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
