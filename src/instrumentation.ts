/**
 * Next.js Instrumentation Hook
 * Runs once on server startup (cold start).
 *
 * NOTE: Auto-migration has been DISABLED to prevent
 * race conditions when multiple instances cold-start simultaneously.
 * Schema changes should be done via Supabase SQL Editor (manual).
 *
 * Pola resmi Next.js untuk kode Node-only: guard
 * `process.env.NEXT_RUNTIME === 'nodejs'` + import ke FILE TERPISAH —
 * cabang ini di-tree-shake pada kompilasi Edge Runtime.
 *
 * RIWAYAT Pensiun 9 Nov 2026: dulu file ini menjalankan marketListener
 * (WS Twelve Data → engine sinyal VIP EMA broadcast ke user PRO) di
 * jalur Node. Engine DIHAPUS — keputusan Bos: "kita kan jurnal, bukan
 * jualan sinyal". Satu-satunya jalur sinyal sekarang = Pine Script
 * milik user sendiri (pine-alert-runner via GHA + cron CF).
 */
/**
 * Deteksi runtime Cloudflare Workers (workerd).
 * Setiap request cron/cold-start di Workers menjalankan register() —
 * import rantai berat (supabase-js + web-push) memakan CPU init yang
 * mahal di plan GRATIS (limit 10 ms CPU/request → "Worker exceeded
 * CPU time limit" → 503 acak). Di Workers: JANGAN import apa pun.
 */
const isCloudflareWorkers =
  (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') ||
  typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== 'undefined'

export async function register() {
  if (isCloudflareWorkers) {
    console.log('✅ [Instrumentation] Cloudflare Workers terdeteksi — register dilewati (cron jalan via worker-entry.ts)')
    return
  }

  // Auto-migration disabled — run migrations manually via Supabase SQL Editor
  console.log('✅ [Instrumentation] Server started (auto-migration disabled)')
}
