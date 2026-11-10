import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.9'
const NOTES = 'Fix 2 bug Bos: (1) Chart beku "abis masang pine gabisa dipencet apa apa" — pine-guard.ts menolak Pine berbahaya (loop while, for to >5000, request.security >10, skrip >80 ribu char/1200 baris) SEBELUM dieksekusi ke vela-pinets yang jalan di main thread browser + race-timeout 45 dtk di runOnChart semua jalur (save/preset/restore fresh-load/daftar); (2) Bot Discord diam — auto-register slash command global (/bos, /nba-oke, /nba-not) via REST bot: dipicu GET endpoint, handshake Verify URL, dan cron harian 08:00 dengan throttle 6 jam; klarifikasi: Interactions Endpoint hanya respons SLASH COMMAND, pesan biasa/mention tidak bisa dijawab tanpa Gateway WebSocket'

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
