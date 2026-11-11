import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.10'
const NOTES = 'KARYAWAN BENERAN KERJA + FIX CPU CRON + IG 3 LAPIS + KANTOR RENOVASI (Bos 11-11): (1) OTAK TIM DIGANTI hasil diag LIVE Bos — nemotron-lightning & nemotron-ultra TERBUKTI HIDUP (612ms/329ms) jadi otak utama semua karyawan (CEO/DA/COO=lightning, CMO/CSO/CTO/GH=ultra, disebar anti-rebut kuota 20 req/mnt); gemma 429 jadi cadangan; xing4.0-29b 404 DIMATIKAN katalog dibuang dari semua rantai (ceo-agent, master-autonomous, agent-proposals, ai-coo-agent, discord, ai-llm); (2) FIX CPU LIMIT cron 15-menit — dulu 10 rute paralel berbagi CPU 1 invocation (3 mati: seo-factory/pengawas/penjaga) kini jalur cepat 3 rute kritis + jalur berat GILIRAN 1 rute per slot (tiap 90 mnt), panggilan hantu pine-alerts (rute sudah dihapus) dibuang; (3) FIX IG "kok ga post ig karyawanku" — window AUTO ig-video-post dibuka 18:00-20:59 WIB (dulu 18-19, Reels telat jam 20 hangus), + jaring pengaman worker cron ikut proses antrean IG saat GitHub Actions telat; (4) KANTOR CEO: mode malam DITERANGIN (plafon/lampu meja/spoket tidak lagi padam total, langit malam lebih hangat), renovasi — neon TRADE·JOURNAL·REPEAT, 4 tanaman pot, 2 lampu gantung pantry, karpet zona kerja.'

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
