/**
 * Next.js Instrumentation Hook
 * Runs once on server startup (cold start).
 * 
 * NOTE: Auto-migration (ensureSchema) has been DISABLED to prevent
 * race conditions when multiple Vercel instances cold-start simultaneously
 * (causes "already exists" vs "does not exist" conflicts on promo_codes).
 * 
 * Schema changes should now be done via:
 *   1. Supabase SQL Editor (manual)
 *   2. Prisma migrations (proper)
 */

export async function register() {
  // Auto-migration disabled — run migrations manually via Supabase SQL Editor
  // or Prisma migrate deploy.
  console.log('✅ [Instrumentation] Server started (auto-migration disabled)')
}