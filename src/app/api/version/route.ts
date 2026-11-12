import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-11.18'
const NOTES = 'FIX KANTOR CEO KOSONG (Bos: "kantor ceo agent ga tampil eror keknya"): TypeError "Cannot read properties of undefined (reading position)" di chunk three.js — helper flat() tidak return mesh, dipakai rug2 (renovasi kantor 11-11) dgn .position.y → crash di tengah konstruksi scene → dinding/kamar/8 karyawan tidak pernah dibuat. flat kini return o. Log error test-create di CF = probe verifikasi sendiri (curl), backdoor sudah mati 405. Versi sebelumnya: 11.17 = security hardening 9 temuan audit + purge 35 route backdoor (admin-login takeover, debug env bocor, create-admin, invoice ownership, webhook Midtrans, promo, keystore).'

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
