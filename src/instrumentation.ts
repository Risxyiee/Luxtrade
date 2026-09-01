/**
 * Next.js Instrumentation Hook
 * Runs once on server startup (cold start).
 * 
 * NOTE: Auto-migration has been DISABLED to prevent
 * race conditions when multiple instances cold-start simultaneously.
 * Schema changes should be done via Supabase SQL Editor (manual).
 */

export async function register() {
  // Auto-migration disabled — run migrations manually via Supabase SQL Editor
  console.log('✅ [Instrumentation] Server started (auto-migration disabled)')
}