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
export async function register() {
  // Auto-migration disabled — run migrations manually via Supabase SQL Editor
  console.log('✅ [Instrumentation] Server started (auto-migration disabled)')

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
