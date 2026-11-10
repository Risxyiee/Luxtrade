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
//                 + Dewi (Data Analyst) + Farhan (Growth Hacker) — LAPORAN HARIAN
//                 (dulu cuma Senin — Bos harus klik manual kalau mau harian)
//   0 3 * * 1  → laporan mingguan Senin 10:00 WIB
//   */15 * * * → watchdog CTO 24/7 (DOWN/bug/kuota → alarm Discord instan)
//               + SWEEP proposal agen otonom (Task 34: 7 agen deteksi trigger
//                 → INSERT ai_pending_actions → CEO ACC di Antrean Eksekusi)
//               + PRICE ALERTS (watchlist target_price → push layar HP;
//                 numpang slot — CF Free maks 5 cron trigger)
//               RIWAYAT PENSIN: VIP SIGNALS (engine EMA broadcast ke
//                 semua user PRO) DIHAPUS 9 Nov 2026 — keputusan Bos:
//                 "kita kan jurnal, bukan jualan sinyal". Sinyal cuma
//                 dari Pine Script milik user (pine-alerts, slot ini
//                 juga) — tidak ada lagi broadcast sinyal tim.
//               + GROWTH SENTINEL (karyawan Kevin: kerja saat zero-traffic —
//                 deteksi kekeringan signup/lead dari data riil → playbook
//                 proaktif narik user baru: social proof, hook CS bot,
//                 email welcome lead, alarm kekeringan; cooldown internal
//                 hemat LLM — run sehat = tanpa panggilan LLM)
//               + SEO FACTORY (karyawan Farhan mode pabrik: terbit 2–3
//                 halaman blog SEO terprogram/hari dari DATA RIIL —
//                 harga/sinyal/kalender; throttle internal 1/run,
//                 maks 3/hari WIB)
//               + COMMENT HUNTER (pemburu komentar IG: pantau komentar
//                 postingan sendiri via Graph API → klasifikasi niat →
//                 balas aman otomatis (maks 5/run & 15/hari) + lapor
//                 prospek ke Discord; hunt maks tiap 2 jam)
//               + CEO TICK (kerja karyawan AI 24 JAM tanpa slot cron baru —
//                 lib/ceo-phase.ts tickDailyWork: 1 panggilan = 1 job jatuh
//                 tempo dikerjakan, dedup harian mencegah dobel kerja LLM;
//                 job Minggu–Sabtu dikerjakan tick pertama setelah 00:00 WIB
//                 alih-alih nunggu batch briefing 08:00; job gagal otomatis
//                 dicoba lagi tick berikutnya; slot cron TETAP 4 — ini cuma
//                 nambah URL ke daftar route slot */15 yang sudah jalan)
//
// CATATAN slot cron: percobaan pakai slot ke-5 utk tick per-menit
//   COMMENT HUNTER DIBATALKAN 8 Nov — CF menolak (error 10072: akun
//   Free sudah genap 5 cron trigger per akun) dan bikin deploy gagal
//   setelah script ter-upload. Comment Hunter kembali ke slot */15.
const CRON_ROUTES = {
  '0 1 * * *': ['/api/cron/daily-reminder', '/api/cron/downgrade-expired-pro', '/api/cron/ai-coo-agent', '/api/ceo-agent?action=briefing', '/api/ceo-agent?action=analyst', '/api/ceo-agent?action=growth', '/api/cron/ig-metrics'],
  '0 3 * * *': ['/api/cron/re-engage', '/api/cron/downgrade-expired-pro'],
  '0 3 * * 1': ['/api/cron/weekly-summary', '/api/ceo-agent?action=weekly'],
  '*/15 * * * *': ['/api/cron/econ-calendar-notify', '/api/ceo-agent?action=watchdog', '/api/ceo-agent?action=tick', '/api/agent-proposals?run=sweep', '/api/cron/pine-alerts', '/api/cron/price-alerts', '/api/cron/prop-firm-guard', '/api/cron/growth-sentinel', '/api/cron/seo-factory', '/api/cron/comment-hunter'],
}

/* Route Ceo-Agent pakai ?key=CRON_SECRET sebagai auth cron (bukan Bearer),
   dan bisa jalan lama (briefing = 1 panggilan Gemini + kirim ±50 email
   berurutan) — makanya timeout-nya 120 dtk, bukan 30 dtk.
   Task 34: /api/agent-proposals?run=sweep ikut pola yang sama (detektor
   bisa memanggil LLM utk menyusun draf proposal → butuh timeout panjang).
   Price-alerts: 1 fetch quote per simbol unik (maks 40 × ~2 dtk) →
   butuh timeout 90 dtk biar batch besar tidak kepotong. */
const CEO_TIMEOUT_MS = 120_000
const DEFAULT_TIMEOUT_MS = 30_000
const PRICE_ALERTS_TIMEOUT_MS = 90_000
/* Prop-firm-guard: loop semua challenge aktif × query trades (DB-only,
   tanpa fetch quote) — 60 dtk cukup utk user banyak. */
const PROP_GUARD_TIMEOUT_MS = 60_000
/* ig-metrics: sampai 12 Reels × 2 panggilan Graph API (±2 dtk per call)
   + ringkasan → 90 dtk biar tidak kepotong pas jaringan lambat. */
const IG_METRICS_TIMEOUT_MS = 90_000
/* growth-sentinel: baca metrik (8 count) + MAKS 1 aksi — aksi cs-hook/
   lead-welcome butuh 1 panggilan LLM (Mortera timeout 60 dtk) → 90 dtk. */
const GROWTH_SENTINEL_TIMEOUT_MS = 90_000
/* seo-factory: kumpul data riil (harga/sinyal/kalender) + 1 insert →
   60 dtk cukup; comment-hunter: Graph API 5 media × 2 call + maks 5
   balasan + 1 LLM opsional → 90 dtk. */
const SEO_FACTORY_TIMEOUT_MS = 60_000
const COMMENT_HUNTER_TIMEOUT_MS = 90_000
const ceoRoute = (route: string) => route.startsWith('/api/ceo-agent') || route.startsWith('/api/agent-proposals')
const timeoutFor = (route: string) =>
  ceoRoute(route)
    ? CEO_TIMEOUT_MS
    : route.startsWith('/api/cron/price-alerts')
      ? PRICE_ALERTS_TIMEOUT_MS
      : route.startsWith('/api/cron/growth-sentinel')
        ? GROWTH_SENTINEL_TIMEOUT_MS
      : route.startsWith('/api/cron/seo-factory')
        ? SEO_FACTORY_TIMEOUT_MS
      : route.startsWith('/api/cron/comment-hunter')
        ? COMMENT_HUNTER_TIMEOUT_MS
      : route.startsWith('/api/cron/prop-firm-guard')
        ? PROP_GUARD_TIMEOUT_MS
        : route.startsWith('/api/cron/ig-metrics')
          ? IG_METRICS_TIMEOUT_MS
          : DEFAULT_TIMEOUT_MS

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

    /* FIX 522 (CF observability 2026-11-06: GET /api/ceo-agent → 522):
       fetch dari DALAM worker ke custom domain sendiri dibalas 522 oleh
       edge CF (loop-back gagal) — briefing/analyst/growth + seluruh route
       cron jadi undian ("Otak Alexander sering off"). Service binding SELF
       (wrangler.jsonc "services") memanggil worker ini LANGSUNG tanpa lewat
       edge/DNS publik — andal, tanpa 522. */
    const selfFetcher = env.SELF && typeof env.SELF.fetch === 'function'
      ? env.SELF.fetch.bind(env.SELF)
      : null
    if (!selfFetcher) {
      console.warn('[cron] binding SELF tidak ada — fallback fetch URL publik (berisiko 522). Pastikan wrangler.jsonc terbaru (services: SELF) sudah ter-deploy.')
    }
    const doFetch = (url: string, init?: RequestInit): Promise<Response> =>
      selfFetcher ? selfFetcher(url, init) : fetch(url, init)

    // SECURITY (audit #17): VAPID_PRIVATE_KEY TIDAK lagi dipakai sebagai
    // auth cron — satu kunci satu fungsi (VAPID = tanda tangan web push).
    // Cron auth: CRON_SECRET / PINE_ALERT_CRON_SECRET saja. If neither is
    // bound, no header is sent and routes reject (fail-closed).
    const cronSecret = env.CRON_SECRET || env.PINE_ALERT_CRON_SECRET || process.env.CRON_SECRET || ''

    console.log(`[cron] Triggered: ${event.cron} → ${routes.join(', ')}`)

    // Semua route paralel (satu waitUntil induk — perilaku setara, tapi
    // hasilnya terkumpul untuk health monitor di bawah).
    ctx.waitUntil((async () => {
      const failures: { route: string; status?: number; error?: string }[] = []

      await Promise.all(routes.map(async (route) => {
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
          if (cronSecret) {
            headers['Authorization'] = `Bearer ${cronSecret}`
            // FIX 401 pine-alerts: kirim DUA format sekaligus — route
            // yang membaca x-cron-secret (bukan Bearer) tetap lolos.
            headers['x-cron-secret'] = cronSecret
          }

          const res = await doFetch(`${siteUrl}${path}`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(timeoutFor(route)),
          })

          if (!res.ok) {
            console.error(`[cron] ${route} → ${res.status}`)
            failures.push({ route, status: res.status })
          } else {
            const body = await res.text()
            console.log(`[cron] ${route} OK:`, body.substring(0, 200))
          }
        } catch (err) {
          const msg = err?.message || String(err)
          console.error(`[cron] ${route} error:`, msg)
          failures.push({ route, error: msg })
        }
      }))

      // ── Health monitor: LAPOR SELALU ke /api/cron/health-alert ──
      // failures kosong = heartbeat sukses (dicatat ke cron_runs);
      // failures > 0 = push + email ke admin (throttle 30 menit di route).
      // Dulu: route gagal cuma muncul di log CF (sering tidak dilihat).
      try {
        const haRes = await doFetch(`${siteUrl}/api/cron/health-alert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cronSecret
              ? { Authorization: `Bearer ${cronSecret}`, 'x-cron-secret': cronSecret }
              : {}),
          },
          body: JSON.stringify({ cron: event.cron, failures, checked: routes, ts: new Date().toISOString() }),
          signal: AbortSignal.timeout(15_000),
        })
        console.log(`[cron] health-alert → ${haRes.status}`)
      } catch (e) {
        console.error('[cron] health-alert error:', e?.message || e)
      }
    })())
  },
}
