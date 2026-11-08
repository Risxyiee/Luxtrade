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
 * cabang ini di-tree-shake pada kompilasi Edge Runtime, sehingga
 * rantai Node (ws/web-push → http/https) tidak masuk bundel edge.
 * (Pola early-return biasa TIDAK cukup — webpack tetap menelusuri
 * import() dan kompilasi edge gagal: "Can't resolve 'http'".)
 */
/**
 * Deteksi runtime Cloudflare Workers (workerd).
 * Setiap request cron/cold-start di Workers menjalankan register() —
 * rantai import marketListener (supabase-js + web-push) memakan CPU init
 * yang mahal di plan GRATIS (limit 10 ms CPU/request → "Worker exceeded
 * CPU time limit" → 503 acak). Di Workers jalur WS memang mustahil jalan
 * (`ws` butuh net/tls — terbukti commit e4c7abc5); sinyal VIP diproduksi
 * jalur cron REST /api/cron/vip-signals. Maka di Workers: JANGAN import
 * apa pun.
 */
const isCloudflareWorkers =
  (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') ||
  typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== 'undefined'

export async function register() {
  if (isCloudflareWorkers) {
    console.log(
      '✅ [Instrumentation] Cloudflare Workers terdeteksi — listener WS dilewati (produksi via cron REST /api/cron/vip-signals)'
    )
    return
  }

  // Auto-migration disabled — run migrations manually via Supabase SQL Editor
  console.log('✅ [Instrumentation] Server started (auto-migration disabled)')

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
