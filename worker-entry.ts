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
//
// Riwayat: ai-cs-agent & ai-marketing-agent DIPENSIUNKAN (dobel dengan
// karyawan Kantor CEO: CSO & CMO) — digantikan 1 karyawan: COO Jualan.
//
// Ruang CEO (Super AI Agent) ikut menumpang jadwal yang sudah ada —
// NOL slot cron baru dipakai:
//   0 1 * * *  → briefing pagi 08:00 WIB (4 agen + AUTO-ACC email pasif)
//   0 3 * * 1  → laporan mingguan + Dewi (Data Analyst) + Farhan (Growth Hacker) Senin 10:00 WIB
//   */15 * * * → watchdog CTO 24/7 (DOWN/bug/kuota → alarm Discord instan)
const CRON_ROUTES = {
  '0 1 * * *': ['/api/cron/daily-reminder', '/api/cron/downgrade-expired-pro', '/api/cron/ai-coo-agent', '/api/ceo-agent?action=briefing'],
  '0 3 * * *': ['/api/cron/re-engage', '/api/cron/downgrade-expired-pro'],
  '0 3 * * 1': ['/api/cron/weekly-summary', '/api/ceo-agent?action=weekly', '/api/ceo-agent?action=analyst', '/api/ceo-agent?action=growth'],
  '*/15 * * * *': ['/api/cron/econ-calendar-notify', '/api/ceo-agent?action=watchdog'],
}

/* Route Ceo-Agent pakai ?key=CRON_SECRET sebagai auth cron (bukan Bearer),
   dan bisa jalan lama (briefing = 1 panggilan Gemini + kirim ±50 email
   berurutan) — makanya timeout-nya 120 dtk, bukan 30 dtk. */
const CEO_TIMEOUT_MS = 120_000
const DEFAULT_TIMEOUT_MS = 30_000
const ceoRoute = (route: string) => route.startsWith('/api/ceo-agent')

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
            const isCeo = ceoRoute(route)
            // ceo-agent otentikasi via ?key=CRON_SECRET (isCron) ATAU
            // ?key=ADMIN_SECRET (isAdmin). Fallback ke ADMIN_SECRET kalau
            // CRON_SECRET belum diset — cron laporan 08:00 tidak lagi
            // gagal 401 secara senyap.
            const ceoKey = env.CRON_SECRET || env.ADMIN_SECRET
            let path = route
            if (isCeo && ceoKey)
              path += (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(ceoKey)

            const headers = { 'Content-Type': 'application/json' }
            if (cronSecret) headers['Authorization'] = `Bearer ${cronSecret}`

            const res = await fetch(`${siteUrl}${path}`, {
              method: 'GET',
              headers,
              signal: AbortSignal.timeout(isCeo ? CEO_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
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
