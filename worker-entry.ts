// @ts-nocheck
/**
 * Cloudflare Worker entrypoint with scheduled() cron handler
 *
 * Wraps the OpenNext-generated worker.js and adds a `scheduled()` export
 * so that Cloudflare cron triggers dispatch to /api/cron/* routes.
 */

// Cron trigger → API routes mapping
// NOTE: Cloudflare Workers Free plan = max 5 cron triggers per account.
// AI agents consolidated into existing schedules (they're background tasks
// that just queue drafts for human approval — exact timing not critical).
const CRON_ROUTES = {
  '0 1 * * *': ['/api/cron/daily-reminder', '/api/cron/downgrade-expired-pro', '/api/cron/ai-cs-agent'],
  '0 3 * * *': ['/api/cron/re-engage', '/api/cron/downgrade-expired-pro'],
  '0 3 * * 1': ['/api/cron/weekly-summary', '/api/cron/ai-marketing-agent'],
  '*/15 * * * *': ['/api/cron/econ-calendar-notify'],
}

export default {
  async fetch(request, env, ctx) {
    // Expose the CF Workers env to getCloudflareContext() BEFORE delegating to OpenNext.
    // This ensures API routes can read secrets (FINNHUB_API_KEY, RAPIDAPI_KEY, etc.)
    // via @opennextjs/cloudflare's getCloudflareContext().env
    try {
      const __cfCtxSym = Symbol.for('__cloudflare-context__')
      if (!globalThis[__cfCtxSym]) {
        globalThis[__cfCtxSym] = { env, cf: request.cf, ctx }
      }
    } catch {}

    // Delegate to the OpenNext-generated worker
    try {
      const worker = await import('./.open-next/worker.js')
      const handler = worker.default || worker
      if (handler.fetch) {
        return handler.fetch(request, env, ctx)
      }
    } catch (err) {
      console.error('[worker-entry] Failed to load OpenNext worker:', err)
    }
    return new Response('Internal Server Error', { status: 500 })
  },

  async scheduled(event, env, ctx) {
    const routes = CRON_ROUTES[event.cron]
    if (!routes) {
      console.warn(`[cron] No routes mapped for: ${event.cron}`)
      return
    }

    const siteUrl = (env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id').replace(/\/+$/, '')
    // Send whichever auth secret exists — econ-calendar-notify accepts either
    // CRON_SECRET or VAPID_PRIVATE_KEY as Bearer. If neither is bound, no
    // header is sent and routes allow the request (no-secrets-configured path).
    const cronSecret = env.CRON_SECRET || env.VAPID_PRIVATE_KEY || process.env.CRON_SECRET || ''

    console.log(`[cron] Triggered: ${event.cron} → ${routes.join(', ')}`)

    for (const route of routes) {
      ctx.waitUntil(
        (async () => {
          try {
            const headers = { 'Content-Type': 'application/json' }
            if (cronSecret) headers['Authorization'] = `Bearer ${cronSecret}`

            const res = await fetch(`${siteUrl}${route}`, {
              method: 'GET',
              headers,
              signal: AbortSignal.timeout(30000),
            })

            if (!res.ok) {
              console.error(`[cron] ${route} → ${res.status}`)
            } else {
              const body = await res.text()
              console.log(`[cron] ${route} OK:`, body.substring(0, 200))
            }
          } catch (err) {
            console.error(`[cron] ${route} error:`, err?.message || err)
          }
        })()
      )
    }
  },
}
