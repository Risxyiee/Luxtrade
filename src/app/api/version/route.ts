import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.10'
const NOTES = 'Kantor di Discord: 6 slash command ACC baru — /setuju [id] (ACC & eksekusi proposal Antrean Eksekusi via jalur admin-key execute-action), /tolak [id], /kerjakan [job] (pencicit 1 tugas jatuh tempo), /laksanakan (semua tugas tick berulang maks 8), /antrean (daftar pending), /status (fase bisnis) — definisi SATU SUMBER lib/discord-commands.ts dipakai auto-register interactions + tombol discord-setup (bulk overwrite tidak lagi saling menghapus). Sirkuit pemutus Pine: flag localStorage tertinggal = sesi terakhir beku saat menjalankan Pine → fresh load MEMBATALKAN auto-restore + banner peringatan (halaman hidup lagi, skrip pembunuh bisa dihapus)'

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
