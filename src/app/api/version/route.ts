import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-10.12'
const NOTES = 'LOOP BELAJAR tim AI (lib/ceo-loop.ts, file Bos): (1) rapat mingguan Senin — evaluasi taruhan minggu lalu via KODE, debat 5 peran, Alexander pilih maks 2 taruhan baru bermetrik, pelajaran disimpan & dipakai rapat berikutnya; (2) konteks keputusan+pelajaran disuntik ke prompt semua karyawan lewat PhaseDeps (cache 60 dtk); (3) atribusi sumber kunjungan & pendaftar: endpoint baru /api/src-track (cookie lux_src 30 hari, dedup harian) + beacon landing + hook register/signUp → KV src:day:*; (4) otonomi bertingkat auto/acc klasifikasi KODE + kill switch action=autopilot; (5) agen produk Raka: backlog perbaikan website berbukti data → ACC Bos → issue GitHub (token Issues:write, tanpa push/PR); (6) panel Loop Belajar di Ringkasan Kantor CEO: ACC/tolak keputusan, lapor angka manual, sumber trafik, backlog, autopilot; cron Senin numpang slot 0 3 * * 1 (nol slot baru)'

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
