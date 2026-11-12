import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.17'
const NOTES = 'SECURITY HARDENING hasil audit independen (Bos terima laporan 9 temuan — SEMUA dieksekusi): (1) KRITIS /api/auth/admin-login dihapus total = backdoor penggantian password akun orang lain (account takeover) mati; (2) KRITIS 34 route debug/backdoor tanpa auth dihapus: /api/debug/* (17), /api/check-env + /api/test-env + /api/test* (7 — show-env membocorkan 20 char SUPABASE_SERVICE_ROLE_KEY), /api/admin/{create-admin,ensure-admin,simple-activate,debug-activate,test-pro,simple-test,test-activation,run-migration} (8 — create-admin bikin akun admin tanpa auth), /api/metaapi/{connect,deals} (2, retired) — selaras daftar MUST_BE_GONE branch security/p0-hardening yang tak pernah di-merge; (3) /api/payment/confirm-payment kini cek kepemilikan invoice (order.userId = user.id, else 403); (4) webhook Midtrans kontrak respons benar: error config/DB/internal = 5xx (Midtrans RETRY), signature invalid = 401, order belum ada = 404, nominal < order = order FAILED + aktivasi DITOLAK (dulu cuma warning tapi PRO tetap aktif), update profile gagal = 500 + jalur idempoten self-heal saat retry; (5) alur promo dibetulkan: apply terima promoCode||code + plan opsional default PRO, claim meneruskan plan, create-transaction kirim kontrak benar + cookie user; (6) android/keystore.jks dikeluarkan dari tracking + *.jks/*.keystore di-gitignore (rotasi key disarankan — file masih ada di history); (7) bun.lock @luxalgo/vela SUDAH sinkron sejak 5463584b (workflow rerun cukup). tsc+eslint lolos.'

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
