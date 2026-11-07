import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-07.1'
const NOTES = 'Audit-fix karyawan sisa: Maya (cooldown 2-fase + segmen cold + learning loop), Bagas (sinyal open/click/bounce + segmen mantan-pembayar + eval konversi), Putri (tren MRR harian + renewal ≤7 hari), Dewi (memori + jam entry + pipa lintas divisi), Alexander (NBA accountability), suppression unsub/bounce 3 gerbang'

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
