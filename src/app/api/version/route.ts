import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.6'
const NOTES = 'Perbaikan logika karyawan AI (anti itu-itu mulu, hasil barang jadi): pilar konten Sinta rotasi harian + hook 10 naskah terakhir dilarang diulang; rapat CSO×CMO skip LLM kalau intel tak berubah (hash); Dewi JANGAN panggil LLM di bawah 50 trade (status data-belum-cukup); Farhan skip funnel LLM di bawah 10 pendaftar (A/B ditunda sampai ada traffic); QA+E2E cukup mingguan (Senin); CFO pre-launch tampil titik impas bukan MRR Rp0; action=art-list/art-body + panel Antrean ACC Artefak di /kantor-ceo (lihat & salin barang jadi karyawan)'

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
