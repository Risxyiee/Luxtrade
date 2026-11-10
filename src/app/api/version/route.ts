import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.4'
const NOTES = 'fix 503 exceededCpu di /api/push/subscribe: rewrite TANPA supabase-js (graph modul 4 lapis = CPU 10ms free plan jebol di isolate dingin) → raw fetch PostgREST + parser cookie sesi salinan middleware; kontrak error 400/401/403/500 dipertahankan; cleanup endpoint stale kini 1 fetch DELETE berfilter; + otak karyawan AI = Claude Sonnet 5.5 semua; + fix login legacy API keys (cache config v2)'

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
