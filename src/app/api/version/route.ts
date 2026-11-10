import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.3'
const NOTES = 'ganti otak SEMUA karyawan AI ke Claude Sonnet 5.5 (permintaan Bos "ganti api ke sonnet semua"): MORTERA_MODEL sonnet-5-5, fallback haiku-5-5, auto-discover utamakan Sonnet, porsi anggaran Mortera 45%→60%, timeout 30/60→40/75 dtk; + fix login legacy API keys (cache config v2)'

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
