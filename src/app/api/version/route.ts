import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.5'
const NOTES = 'Kantor CEO fase bisnis (lib/ceo-phase.ts): briefing SINGKAT tanpa LLM saat pre-launch (bukan Senin), NBA dari checklist peluncuran 8 langkah (maju hanya saat Bos jawab OKE), artefak mingguan karyawan AI (kalender konten, onboarding, titik impas, outbound, eksperimen, artikel SEO, audit SEO, seeding) otomatis tiap briefing fase-2 + action=work/phase; env PHASE_OVERRIDE utk paksa fase'

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
