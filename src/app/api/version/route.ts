import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-13.1'
const NOTES = 'LUX ENGINE MEGA-COMPAT + AI DIAG + LICENSI BERSIH: (1) Lux Engine src/engine/lux diperluas biar script Pine asli Bos minim error — deklarasi bertipe (int/float/bool/string/color + var float x), line continuation call multi-baris ala formatter TradingView, varip, import diabaikan, while + break/continue, switch (statement & x = switch …), if sebagai nilai (x = if cond …), tuple Pine [m,s,h] = ta.macd / ta.bb / ta.dmi / ta.supertrend, funcdef parameter bertipe + default arg, unary +, konkatenasi string (series string), konstanta member Pine (strategy.long/short/position_size, color.*, shape.*, location.*, size.*, display.*, timeframe.period/s-multiplier, syminfo.*, barstate.*, dayofweek.*, math.pi/e), fungsi ta. baru (vwma, hma, mom, roc, tr, stoch, wpr, cci, mfi, obv, barssince, valuewhen, highestbars/lowestbars, linreg, median, range, vwap, sar, rising/falling, pivothigh/pivotlow), math.* baru (avg, sum, log10, todegrees/toradians, round(x,prec)), str.* baru (length/contains/startswith/endswith/upper/lower/trim/replace_all/replace_one/substring/repeat/format), fungsi waktu (year/month/dayofmonth/dayofweek/hour/minute/second — zona Asia/Jakarta, timestamp, timenow), request.security & array/matrix/map ditolak dengan pesan jelas, dan SEMUA error runtime sekarang menyebut nomor baris (fix laporan "eror di baris 32"); verifikasi 9 skenario script TradingView nyata PASS (typed decl, multiline call, tuple, switch, while, supertrend, pivothigh, strategy.entry). (2) AI STAFF DIAGNOSTIK: log 15 panggilan LLM terakhir dipersist ke KV & tampil di /api/health (field llmRecent) — Bos bisa lihat sendiri karyawan pakai provider apa; saldo Mortera < Rp 5.000 → field morteraLow warning (saldo produksi 13 Nov Rp 11.791 — makin kecil makin sering jatuh ke rantai gratis; top-up di dashboard Mortera). (3) LICENSI: LICENSE diganti proprietary all-rights-reserved (keputusan Bos — lisensi lama tidak dipakai lagi), README section Pine lama diganti dokumentasi Pine Lab/Lux Engine, dead code engine sinyal lama src/lib/signals/ (338 baris, tidak diimpor siapa pun) dihapus, semua komentar kode bebas sebutan lisensi pihak ketiga. Versi sebelumnya: 11.12.4 = fix akses Pine Lab (rekoniliasi tabel pine_scripts lama tanpa kolom active — biang error 42703) + cleanup dead code stack Sinyal VIP; 11.12.3 = pine dinonaktifkan; 11.12.2 = Pine Signals edge-ready.'

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
