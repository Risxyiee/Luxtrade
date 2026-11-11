import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.11'
const NOTES = 'Tambalan fase bisnis lengkap: (1) Dewi & Farhan dedup input-hash mingguan + flag skipped (tidak bakar LLM untuk laporan kembar); (2) caption cadangan IG tak lagi sebut data komunitas saat <20 trade; (3) ACC via Discord /nba-oke kini memajukan checklist peluncuran lewat action nba-verdict; (4) action phase membawa launch+artifacts utk panel baru; (5) PhasePanels di Ruang Rapat: kartu fase, progres 10 user, langkah checklist, tombol kerja manual + artefak per ruangan karyawan + mode pre-launch di kartu tim; (6) comment-hunter cukup dipanggil di jendela pertama tiap 2 jam (hemat subrequest cron)'

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
