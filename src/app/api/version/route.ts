import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.8'
const NOTES = 'HARNESS ENGINE V3 (UNIFIED LOOP) terpasang: lib/harness-prompt.ts — semua karyawan AI dibungkus identitas + mandat domain (EXTERNAL_GROWTH: viral/traffic/revenue; INTERNAL: zero-bug/kecepatan <1.5s/anti-churn) + aturan mutlak zero-fluff (haram kata klise AI: dinamis/revolusioner/solusi terbaik/mengoptimalkan/yuk simak/di era digital; haram placeholder [insert ...]; gaya spesialis senior) lewat satu titik injeksi agentBrain; artefak mingguan (llmJob ceo-phase) dapat tambahan THE 4-STEP AGENTIC LOOP think→learn→solve→work dengan larangan mengulang angle + larangan menampilkan proses berpikir di output'

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
