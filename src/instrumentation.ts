/**
 * Next.js Instrumentation Hook
 * Runs once on server startup (cold start) — perfect for auto-migration.
 * https://nextjs.org/docs/app/building-your-application/configuring/instrumentation
 */

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid bundling issues
    const { ensureSchema } = await import('@/lib/db')
    // Fire-and-forget: don't block server startup, but log completion
    ensureSchema().then(() => {
      console.log('✅ [Instrumentation] Auto-migration completed on server startup')
    }).catch((err: any) => {
      console.error('⚠️ [Instrumentation] Auto-migration failed (non-critical):', err?.message)
    })
  }
}