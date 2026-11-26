import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-26.1'
const NOTES = 'FIX PINE LAB "ga jalan sama sekali, semua eror" (laporan Bos 26-11) — Lux Engine diperluas biar SEMUA script Pine asli trader jalan: (1) FUNGSI USER MULTI-LINE — biang error utama: f(x) => dengan body ter-indent (banyak statement + nilai kembali = ekspresi terakhir, semantik Pine v5) sebelumnya cuma dukung satu-ekspresi sehingga SEMUA script pakai helper function kena PARSE_ERROR token tak terduga newline. (2) RIWAYAT HASIL FUNGSI: ta.highest(high,20)[1], ta.ema(close,9)[3], ta.crossover(a,b)[1] — sebelumnya hard error, kini tiap call-site punya buffer history sendiri. (3) TUPLE SEBAGAI RETURN VALUE: baris terakhir [hi, lo, rng] di body fungsi → call-site [x, y, z] = f(...) dapat multi-value sekaligus. (4) study() (Pine v4) jadi alias indicator() — script lama jalan. (5) strategy.* tak dikenal (risk.max_intraday_loss dsb.) + plotcandle/plotbar/plotarrow = no-op visual, bukan hard error. (6) ta.obv dihitung beneran (kumulatif volume). (7) Komentar blok /* */ quote-aware bisa menyeberang baris. Verifikasi: 47 skenario test script TradingView nyata — 45 PASS, 2 sisa (request.security & array) memang by-design dengan pesan jelas. Versi sebelumnya: 2026-11-13.1 = Lux Engine mega-compat batch pertama + AI diagnosi + lisensi bersih.'

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
