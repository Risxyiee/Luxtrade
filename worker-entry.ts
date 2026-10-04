// @ts-nocheck
/**
 * Cloudflare Worker entrypoint with scheduled() cron handler
 *
 * Wraps the OpenNext-generated worker.js and adds a `scheduled()` export
 * so that Cloudflare cron triggers dispatch to /api/cron/* routes.
 */

// Cron trigger → API routes mapping
const CRON_ROUTES = {
  '0 1 * * *': ['/api/cron/daily-reminder', '/api/cron/downgrade-expired-pro'],
  '0 3 * * *': ['/api/cron/re-engage', '/api/cron/downgrade-expired-pro'],
  '0 3 * * 1': ['/api/cron/weekly-summary'],
}

// The symbol used by @opennextjs/cloudflare to store the CF context on globalThis.
// Setting it HERE (before delegating to the OpenNext worker) guarantees that
// getCloudflareContext() returns the env immediately — even if the OpenNext
// worker's own init hasn't run yet or the dynamic import has a timing gap.
const __cloudflareContextSymbol = Symbol.for('__cloudflare-context__')

export default {
  async fetch(request, env, ctx) {
    // Explicitly set the Cloudflare context on globalThis so that
    // @opennextjs/cloudflare's getCloudflareContext() can find it.
    // This is the SAME thing OpenNext's worker.js does internally,
    // but setting it here guarantees availability from the first line
    // of any Next.js route handler.
    if (!globalThis[__cloudflareContextSymbol]) {
      globalThis[__cloudflareContextSymbol] = { env, cf: request.cf, ctx }
    }

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

    const siteUrl = env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
    const cronSecret = env.CRON_SECRET || ''

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
