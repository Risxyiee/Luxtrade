import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.7'
const NOTES = 'Karyawan AI kerja 24 JAM tanpa slot cron Cloudflare baru: mode tick (ceo-phase.ts tickDailyWork — 1 panggilan HTTP = 1 job jatuh tempo, dedup harian anti dobel kerja LLM, job gagal retry otomatis) + action=tick di /api/ceo-agent (?key=CRON_SECRET) yang menumpang slot */15 yang sudah ada di worker-entry.ts + bisa ditembak cron eksternal gratis (cron-job.org/UptimeRobot) sebagai redundansi; artefak kini lahir tick pertama setelah 00:00 WIB alih-alih nunggu batch briefing 08:00'

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
