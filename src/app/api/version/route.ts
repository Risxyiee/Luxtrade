import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.2'
const NOTES = 'fix V2 otak karyawan templat mulu padahal api berbayar: cooldown timeout 5 mnt→90 dtk + retry model timeout sekali + Mortera timeout 30/60 dtk + agentBrain BUDGET-AWARE (Mortera maks 45% anggaran, OpenRouter per-model ikut sisa) + compose maxTokens 1200; fix CSV jurnal ringkas tanggal/pair/trade/pnl (header Indonesia + baris tanpa harga)'

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
