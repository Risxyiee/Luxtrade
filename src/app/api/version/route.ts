import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.12'
const NOTES = 'ALERT LUXTRADEE = SOLUSI MURAH PENGGANTI ALERT TRADINGVIEW (Bos 11-11: "butuh alert yang di pinescript, bikin solusi buat orang yg bayar mahal tradingview biar ke websiteku") + LANDING BIRU: (1) Tombol "Buat Alert" di chart KINI MEMBUKA MODAL IN-APP (AlertCreatorModal) — pilih simbol, pasang target harga, catatan → tersimpan ke watchlist → engine cron /api/cron/price-alerts (cek tiap 15 mnt, deteksi sentuh/nyeberang) → PUSH NOTIF KE HP via web-push — TANPA langganan TradingView Essential ±$13/bln; modal punya daftar alert aktif + ubah target + hapus; PRO_REQUIRED ditangani dengan upsell "tetap jauh lebih murah dari TradingView"; jalan pintas ke chart TradingView tetap ada utk drawing/indikator; (2) LANDING TradingViewShowcase: bullet "Alert native TradingView" DIGANTI "Alert harga otomatis — tanpa langganan TradingView" (dengan harga pembanding ±$13/bln) + CTA "Coba Chart & Alert TradingView" (tadi keluar ke tradingview.com!) KINI MENUJU /auth/signup Luxtradee + sub-teks "hemat ±$13/bulan"; (3) WARNA BIRU sesuai arahan Bos: badge POWERED BY TRADINGVIEW + 4 kartu fitur + CTA (ungu→biru), PartnerBanner ProFirm (hijau→biru), badge PUSTA BELAJAR (ungu→biru); (4) banner FundingTraders (oranye) TIDAK diubah sesuai "itu aja".'

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
