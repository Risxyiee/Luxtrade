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
//               + LOOP BELAJAR (lib/ceo-loop.ts): rapat mingguan tim AI
//                 (evaluasi taruhan minggu lalu + debat 5 peran + Alexander
//                 pilih maks 2 taruhan baru) dan review produk Raka
//                 (backlog perbaikan website berbukti data → ACC Bos →
//                 issue GitHub). Numpang slot Senin — nol slot cron baru.
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
// ══ FIX CPU LIMIT (alarm Bos 11-11-2026 17:30 UTC: 3 rute "Pekerja
// melampaui batas waktu CPU") ═══════════════════════════════════════
// Slot */15 dulu menjalankan 10 rute PARALEL dalam SATU invocation
// scheduled() — semuanya berbagi budget CPU worker yang sama → rute
// berat (seo-factory, agen sweep, pengawas) saling berebut CPU → 3 rute
// mati "CPU time exceeded" sekaligus. Kini slot */15 dipecah 2 jalur:
//   • JALUR CEPAT (tiap slot, ringan/kritis): econ-calendar-notify,
//     ceo watchdog, price-alerts, strategy-alerts (alert indikator
//     ala Pine — RSI/EMA/MACD, cap 30 group fetch — tetap ringan).
//   • JALUR BERAT (GILIRAN — 1 rute per slot): tick, sweep proposal,
//     prop-firm-guard, growth-sentinel, seo-factory, comment-hunter →
//     tiap rute berat jalan tiap 90 menit (6 slot), CPU per invocation
//     turun ~60%, dan cooldown internal tiap karyawan tetap jauh lebih
//     panjang dari itu (growth-sentinel per jam, comment-hunter 2 jam).
// RIWAYAT PENSUN: /api/cron/pine-alerts DIHAPUS (Velalab dihapus total,
// commit e540a712) — panggilan hantunya di CRON_ROUTES lama ikut dibuang
// (tiap 15 menit hanya buang 1 subrequest + 404 + alarm failures palsu).
//
// CATATAN slot cron: percobaan pakai slot ke-5 utk tick per-menit
//   COMMENT HUNTER DIBATALKAN 8 Nov — CF menolak (error 10072: akun
//   Free sudah genap 5 cron trigger per akun) dan bikin deploy gagal
//   setelah script ter-upload. Comment Hunter kembali ke slot menit-5.
/* Slot MENIT-5 (Bos 11-11: "gabisa setiap 5 menit kah? 15 menit kelamaan")
   — GANTI isi slot 15-menit lama, TANPA nambah trigger (tetap 1 slot;
   CF Free maks 5 trigger/akun, kita cuma pakai 4). Slot kini nembak
   tiap 5 menit dan tiap rute ATUR CADENCENYA SENDIRI via EVERY_MIN:
     • strategy-alerts  → TIAP 5 MENIT (alert strategi Bos: tidak kelamaan)
     • econ-calendar-notify, ceo watchdog, price-alerts → tetap 15 menit
       (%15 < 5 — hanya slot :00/:15/:30/:45 yang due)
     • comment-hunter → tetap 120 menit
   JALUR BERAT tetap giliran 1 rute/slot 15-menit (hanya jalan di
   menit ke-0/15/30/45 — slotNo bucket 900_000 dipertahankan). */
const FAST_5MIN = ['/api/cron/econ-calendar-notify', '/api/ceo-agent?action=watchdog', '/api/cron/price-alerts', '/api/cron/strategy-alerts']
const CRON_ROUTES: Record<string, string[]> = {
  '0 1 * * *': ['/api/cron/daily-reminder', '/api/cron/downgrade-expired-pro', '/api/cron/ai-coo-agent', '/api/ceo-agent?action=briefing', '/api/ceo-agent?action=analyst', '/api/ceo-agent?action=growth', '/api/cron/ig-metrics', '/api/discord-interactions'],
  '0 3 * * *': ['/api/cron/re-engage', '/api/cron/downgrade-expired-pro'],
  '0 3 * * 1': ['/api/cron/weekly-summary', '/api/ceo-agent?action=weekly', '/api/ceo-agent?action=meeting', '/api/ceo-agent?action=product-review'],
  // Kunci '5-menit' dipakai wrangler baru; kunci '15-menit' disimpan sbg
  // alias transisi (deploy lama yang masih pakai trigger 15-menit tetap jalan).
  '*/5 * * * *': FAST_5MIN,
  '*/15 * * * *': FAST_5MIN,
}

/* JALUR BERAT slot 15-menit — GILIRAN: tiap eksekusi hanya 1 rute dari daftar
   ini (index = nomor slot % panjang daftar). Tiap rute jalan tiap 90 menit
   (6 slot × 15 menit) — masih jauh lebih rapat daripada cooldown internal
   masing-masing (growth-sentinel aksi per 1–12 jam, comment-hunter 2 jam,
   seo-factory maks 3/hari). CPU per invocation tetap kecil meski slot
   lain (jalur cepat) jalan bersamaan. */
const HEAVY_15_ROUND_ROBIN = [
  '/api/ceo-agent?action=tick',
  '/api/agent-proposals?run=sweep',
  '/api/cron/prop-firm-guard',
  '/api/cron/growth-sentinel',
  '/api/cron/seo-factory',
  '/api/cron/comment-hunter',
  /* Jaring pengaman IG (keluhan Bos "kok ga post ig karyawanku"):
     GH Actions instagram-cron (18:45/20:30 WIB) kadang telat/skipped
     (runner antre berjam-jam). Worker cron kini ikut memproses antrean
     instagram_posts di slot giliran — window konten 18:00–20:59 WIB
     tetap dipegang route (di luar window rute hanya melaporkan). */
  '/api/cron/ig-auto-post',
]

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
/* strategy-alerts (alert indikator ala Pine): maks 30 group × 1 fetch
   candle 120-bar (~2 dtk) + evaluasi matematika murni → 90 dtk. */
const STRATEGY_ALERTS_TIMEOUT_MS = 90_000
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
/* PATCH B (tambalan fase bisnis): rute yang cukup dipanggil tiap N menit —
   WINDOW kini 5 menit (slot nembak tiap 5 menit): dueNow = menit % N < 5.
   strategy-alerts TIDAK masuk peta → due tiap slot = tiap 5 menit
   (permintaan Bos: 15 menit kelamaan). Rute lain jaga jadwal lama. */
const EVERY_MIN: Record<string, number> = {
  '/api/cron/econ-calendar-notify': 15,
  '/api/ceo-agent?action=watchdog': 15,
  '/api/cron/price-alerts': 15,
  '/api/cron/comment-hunter': 120,
}
const dueNow = (route: string, t: number) => {
  const n = EVERY_MIN[route]
  return !n || Math.floor(t / 60_000) % n < 5
}
const ceoRoute = (route: string) => route.startsWith('/api/ceo-agent') || route.startsWith('/api/agent-proposals')
const timeoutFor = (route: string) =>
  ceoRoute(route)
    ? CEO_TIMEOUT_MS
    : route.startsWith('/api/cron/price-alerts')
      ? PRICE_ALERTS_TIMEOUT_MS
      : route.startsWith('/api/cron/strategy-alerts')
        ? STRATEGY_ALERTS_TIMEOUT_MS
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
    /* PATCH B: filter dueNow — rute non-kritis hanya jalan di jendela pertama
       window intervalnya (mis. comment-hunter tiap 120 menit = 8 slot per
       15 menit pertama tiap 2 jam). */
    let routes = (CRON_ROUTES[event.cron] || []).filter((r) => dueNow(r, event.scheduledTime))

    /* FIX CPU LIMIT: JALUR BERAT hanya di slot menit 0/15/30/45 (menit %15 < 5)
       — TEPAT 1 rute berat bergilir per slot 15-menit (round-robin). Nomor
       slot stabil dari scheduledTime → deploy ulang tidak mereset urutan.
       Comment-hunter tetap hormati dueNow (throttle 2 jamnya sendiri). */
    if (event.cron === '*/5 * * * *' || event.cron === '*/15 * * * *') {
      const t = event.scheduledTime
      if (Math.floor(t / 60_000) % 15 < 5) {
        const slotNo = Math.floor(t / 900_000)
        const heavy = HEAVY_15_ROUND_ROBIN[slotNo % HEAVY_15_ROUND_ROBIN.length]
        if (dueNow(heavy, t)) routes.push(heavy)
      }
    }

    if (!routes.length) {
      console.log(`[cron] Slot ${event.cron} dilewati (semua rute belum jatuh tempo jendela intervalnya)`)
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
            /* Catat ISI respons di log + payload health-alert — gagal cron
               jadi terdiagnosis (bukan cuma angka status). */
            const body = await res.text().catch(() => '')
            console.error(`[cron] ${route} → ${res.status} ${body.slice(0, 300)}`)
            failures.push({ route, status: res.status, error: body.slice(0, 300) })
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
