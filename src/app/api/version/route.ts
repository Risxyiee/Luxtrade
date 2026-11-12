import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.16'
const NOTES = 'SKILL PAKET KARPATHY (Bos: "sekalian tambah skil buat karyawan aiku, ini ada beberapa simpan baik"): 4 rujukan karpathy yang Bos simpan (autoresearch, llm-wiki gist, nanoGPT, nanochat) dibedah → 48 topik skill konkret (6/karyawan × 8 karyawan AI) digabung ke kurikulum harian akademi via fullCurriculum() — rotasi otomatis, tanpa perubahan cron/prompt lain. Versi sebelumnya: 11.15 = fix cron strategy-alerts 500 (PGRST205) + slot 5-menit.'

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
