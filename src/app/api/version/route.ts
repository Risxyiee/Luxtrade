import { NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════
// Fingerprint build produksi — /api/version
// Bump VERSION setiap rilis penting. Dipakai untuk membuktikan pipeline
// deploy (Workers Builds / GitHub Actions) benar-benar mengirim kode
// terbaru ke Cloudflare: kalau endpoint ini 404 / versi lama → build
// produksi tidak jalan.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const VERSION = '2026-11-12.4'
const NOTES = 'PINE LAB FIX AKSES + CLEANUP DEAD CODE: (1) FIX "gabisa masuk Pine Lab" — SQL supabase/migrations/20261113_pine_lab_fix.sql merekonsiliasi tabel pine_scripts lama era pine-alert (tanpa kolom active, biang error 42703), membuat ulang pine_events_sent/pine_runs/user_flags dengan skema resmi (kolom trigger dikutip — kata tercadang PG), dan seed flag pine_lab untuk akun admin → gate /pine-lab terbuka; (2) DEAD CODE dibuang: stack Sinyal VIP yang pensiun 9 Nov (marketListener 880+ baris, /api/cron/vip-signals, /api/vip-signals/latest, instrumentation-node.ts) + docs PINE_ALERT_PINE_SCRIPTS.sql + scripts/test-vip-fix.ts; (3) dependency pinets (AGPL) DICABUT dari package.json — spek: nol kode AGPL. Versi sebelumnya: PINE LAB PRIVAT + FIX GAMBAR CHART: (1) FIX laporan Bos "mau gambar garis di chart gabisa, kursor ga fokus" — CookieConsent (root layout, fixed bottom z-50) menelan klik/drag area chart → wrapper kini pointer-events-none + ChartTab dapat tombol MODE FOKUS (fullscreen top-layer, drawing 100% bersih) + chart container isolate z-0 select-none; (2) PINE LAB /pine-lab sesuai spek revisi Bos — halaman privat ber-flag user_flags.pine_lab (seed akun admin), Lux Engine modul mandiri src/engine/lux (clean-room subset Pine Script: ta./math./str., var, if/for, funcdef, named args, namedarg kwargs, guardrail deadline 2 dtk + step budget + cap — NOL dependensi, BUKAN pinets/AGPL), API /api/pine-lab/* (scripts CRUD + run manual rate-limit 20/jam + kuota 3 aktif/50 KB), cron jam-an /api/cron/pine-lab (candle H1 sekali/jam per simbol → semua script aktif → event BARU saja via pine_events_sent → push ke pemilik; 1 script gagal tidak menghentikan lain; durasi run dicatat), SQL supabase/migrations/20261112_pine_lab.sql WAJIB dijalankan manual Bos (4 tabel + RLS deny-all + seed flag), UI dengan disclaimer bukan-nasihat-keuangan + label sumber data + link /terms. Cadangan engine lama (pinets/AGPL) tetap terhapus. Versi sebelumnya: 11.12.3 = pine dinonaktifkan; 11.12.2 = Pine Signals edge-ready.'

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
