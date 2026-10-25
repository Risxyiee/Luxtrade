// app/api/ceo-agent/route.ts — LUXTRADE SUPER AI AGENT (Ruang CEO)
// Next.js API Route · target deploy: Cloudflare Workers (OpenNext)
// Fetch native. TANPA Vercel AI SDK. TANPA Hono. TANPA node-fetch.
// Auth: header "Authorization: Bearer ADMIN_SECRET" atau ?key=CRON_SECRET
// Cron 08:00 WIB: Cloudflare cron trigger (worker-entry.ts) → /api/ceo-agent?action=briefing&key=CRON_SECRET
// (cron-job.org TIDAK diperlukan lagi — semua otomatis lewat trigger Workers bawaan)
// ============================================================
// Tabel Supabase yang dipakai (skema produksi Luxtradee — lihat
// prisma/schema.prisma):
//  profiles    → data user (email, created_at, is_pro, …)
//  trades      → upload jurnal trading (user_id, created_at) — basis "user aktif"
//  bug_reports → laporan bug dari user (created_at, status) — basis CTO
//  agent_kv    → KV internal (supabase-migrations/012_create_agent_kv.sql)
// ============================================================
// NOTE: No runtime = 'edge' — OpenNext limitation for API routes.
// Seluruh app sudah berjalan di Cloudflare Workers (edge) via OpenNext,
// route ini pun otomatis jalan di Worker yang sama. Semua API yang dipakai
// (fetch, AbortController, Intl) Workers-compatible.
export const dynamic = 'force-dynamic'

interface Env { [k: string]: string | undefined }

/* Nilai secret dari dashboard kadang ke-paste dgn tanda kutip/spasi → 401.
   Bersihkan dulu sebelum dipakai. */
const cleanEnv = (v: string | undefined) =>
  (v || '').trim().replace(/^["']+|["']+$/g, '')

/* PENTING (fix briefing cron "—"/gagal diambil): NEXT_PUBLIC_* direferensikan
   LANGSUNG di sini supaya Next.js meng-inline nilainya saat BUILD. Akses
   dinamis process.env[...] di Cloudflare Workers hanya membaca runtime
   binding — kalau key cuma diset di Build settings (bukan Variables &
   Secrets), cron kehilangan kunci Supabase padahal situs normal-normal saja
   (bundle browser ter-inline saat build). Urutan fallback: runtime secret →
   NEXT_PUBLIC runtime → nilai inline build. */
const INLINED_SB_URL: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
const INLINED_SB_KEY: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const SITE_URL = 'https://luxtradee.web.id'
const EMAIL_FROM = 'LuxTradee <noreply@luxtradee.web.id>'
const ANGLES = [
  'Pain point trader XAUUSD yang belajar SMC/ICT — pusing struktur, liquidity, FVG, killer zone, tapi akun tetap kena MC.',
  'Kelelahan ngetik jurnal trading manual setiap hari — males, gak konsisten, gak tahu harus evaluasi apa.',
  'Cara menjaga max daily loss prop firm dengan evaluasi visual — screenshot chart + penandaan.',
]

/* ---------- util ---------- */
function timeoutSignal(ms: number): AbortSignal {
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}
const isoAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const utcDay = (off = 0) => new Date(Date.now() + off * 86400_000).toISOString().slice(0, 10)
const dayIndex = () => Math.floor(Date.now() / 86400_000)
const fmtN = (n: number) => (n >= 0 ? n.toLocaleString('id-ID') : '—')
const wibNow = () =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date())
const env = () => process.env as Env

function sbUrl(e: Env) {
  // URL project DIPATOK (env atau fallback yang sama dgn src/lib/api-auth.ts)
  // — tidak boleh bisa diganti dari luar, kalau tidak email-gate bisa dipalsukan
  return (cleanEnv(e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL || INLINED_SB_URL) || 'https://klxkdrfsfcoankbaoejn.supabase.co').replace(/\/$/, '')
}
function sbAnonKey(e: Env) {
  return cleanEnv(e.SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || INLINED_SB_KEY)
}
/* Service role key — bypass RLS untuk CEO agent (baca profiles/trades/bug_reports
   tanpa diblok policy anon). Ambil dari env SUPABASE_SERVICE_ROLE_KEY.
   Kalau belum diset, fallback ke anon key (data tertentu akan 401). */
function sbServiceKey(e: Env) {
  return cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) || sbAnonKey(e)
}
function ownerEmail(e: Env) {
  return (cleanEnv(e.OWNER_EMAIL) || 'luxtradee@gmail.com').toLowerCase()
}
/* ---------- verifikasi token login Supabase (email-gate CEO) ----------
   Token Bearer dari sesi login user → GET /auth/v1/user → cocokkan email. */
async function verifyOwnerToken(e: Env, token: string): Promise<boolean> {
  if (!sbUrl(e) || !sbAnonKey(e) || !token) return false
  try {
    const res = await fetch(`${sbUrl(e)}/auth/v1/user`, {
      headers: { apikey: sbAnonKey(e), Authorization: `Bearer ${token}` },
      signal: timeoutSignal(10_000),
    })
    if (!res.ok) return false
    const user = (await res.json()) as { email?: string }
    return (user?.email || '').toLowerCase().trim() === ownerEmail(e)
  } catch { return false }
}

/* ---------- KV berbasis tabel Supabase "agent_kv" ----------
   (jalankan SQL create table agent_kv sekali di Supabase — lihat
    supabase-migrations/012_create_agent_kv.sql) */
async function kvGet(e: Env, key: string): Promise<string | null> {
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/agent_kv?select=value&key=eq.${encodeURIComponent(key)}`,
    { headers: sbH(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as { value?: string }[]
  return rows[0]?.value ?? null
}
async function kvSet(e: Env, key: string, value: string): Promise<void> {
  await fetch(`${sbUrl(e)}/rest/v1/agent_kv?on_conflict=key`, {
    method: 'POST',
    headers: { ...sbH(e), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value }),
    signal: timeoutSignal(10_000),
  })
}
async function kvIncr(e: Env, key: string): Promise<number> {
  const cur = parseInt((await kvGet(e, key)) || '0', 10)
  await kvSet(e, key, String(cur + 1))
  return cur + 1
}

/* ---------- Supabase headers ---------- */
/* sbH = anon key — untuk tabel yang punya RLS policy SELECT untuk anon (agent_kv, dll) */
function sbH(e: Env) {
  return { apikey: sbAnonKey(e), Authorization: `Bearer ${sbAnonKey(e)}` }
}
/* sbHPriv = service_role key — bypass RLS, untuk CEO agent baca profiles/trades/bug_reports */
function sbHPriv(e: Env) {
  const sk = sbServiceKey(e)
  return { apikey: sbAnonKey(e), Authorization: `Bearer ${sk}` }
}
async function supaCount(e: Env, table: string, filters = ''): Promise<number> {
  const url = `${sbUrl(e)}/rest/v1/${table}?select=*&limit=1${filters ? '&' + filters : ''}`
  /* Gunakan service_role key untuk tabel yang butuh bypass RLS.
     agent_kv punya RLS policy SELECT untuk anon → pakai sbH saja.
     profiles/trades/bug_reports butuh service_role → pakai sbHPriv. */
  const usePriv = ['profiles', 'trades', 'bug_reports'].includes(table)
  const res = await fetch(url, { headers: { ...(usePriv ? sbHPriv(e) : sbH(e)), Prefer: 'count=exact' }, signal: timeoutSignal(10_000) })
  if (!res.ok) {
    const hint = res.status === 401
      ? (usePriv && !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)
        ? ' — RLS blokir anon key. Set SUPABASE_SERVICE_ROLE_KEY di Cloudflare Secrets (Supabase → Settings → API → service_role secret)'
        : ' — SUPABASE_ANON_KEY / SERVICE_ROLE_KEY salah/expired (cek Cloudflare Secrets: tanpa kutip & spasi)')
      : res.status === 404
        ? ` — tabel "${table}" tidak ada`
        : ''
    throw new Error(`Supabase ${table} HTTP ${res.status}${hint}`)
  }
  const cr = res.headers.get('content-range') || '' // "0-0/1240" atau "*/0"
  const total = parseInt(cr.split('/')[1] || '', 10)
  if (!Number.isFinite(total)) throw new Error(`content-range tidak terbaca: "${cr}"`)
  return total
}

/* ============================================================
   AGEN 1 — CTO (IT & QA): ping situs + bug report 24 jam
   ============================================================ */
function siteStatusNote(status: number): string {
  return String(status)
}
void siteStatusNote

async function ctoAgent(e: Env) {
  const ping = async () => {
    const t0 = Date.now()
    try {
      const res = await fetch(SITE_URL, { method: 'GET', redirect: 'follow', signal: timeoutSignal(15_000) })
      return { status: res.status, siteOk: res.ok, latencyMs: Date.now() - t0, err: '' }
    } catch (x: any) {
      return { status: 0, siteOk: false, latencyMs: Date.now() - t0, err: String(x?.message || x) }
    }
  }

  let site = await ping()
  if (!site.siteOk) {
    // self-ping ke domain publik kadang gagal sesaat (redeploy/edge hiccup) — retry 1x
    await new Promise((r) => setTimeout(r, 1500))
    const retry = await ping()
    if (retry.siteOk || !site.err) site = retry
  }

  // 521-524 = Cloudflare edge gagal hubungi "origin". Padahal route ini EKSEKUSI
  // DI DALAM Worker yang sama → kalau kita bisa jalan, situs pasti hidup.
  // Self-ping CF 5xx = false negative yang dikenal → anggap OK.
  let err = site.err
  if (!site.siteOk && [521, 522, 523, 524].includes(site.status)) {
    site.siteOk = true
    err = `${site.status} (self-ping CF diabaikan — Worker aktif, situs LIVE)`
  }

  let bugs24h = -1
  try { bugs24h = await supaCount(e, 'bug_reports', 'created_at=gte.' + isoAgo(24)) }
  catch (x: any) { err = err || String(x?.message || x) }
  /* riwayat watchdog hari ini (dicatat action=watchdog tiap 15 mnt) */
  let upToday = 0, downToday = 0
  try {
    upToday = parseInt((await kvGet(e, `up:${utcDay()}`)) || '0', 10)
    downToday = parseInt((await kvGet(e, `down:${utcDay()}`)) || '0', 10)
  } catch { /* ignore */ }
  return { title: 'CTO — IT & QA', siteOk: site.siteOk, status: site.status, latencyMs: site.latencyMs, bugs24h, upToday, downToday, err }
}

/* ============================================================
   AGEN 2 — CSO (Customer Success): pendaftar / aktif / pasif
   Basis data: profiles (total) + trades 24 jam (aktivitas upload).
   Tidak ada kolom last_upload_at di skema ini — "user aktif" =
   pemilik user_id yang muncul di trades dalam 24 jam terakhir.
   ============================================================ */
async function fetchActiveUserIds(e: Env, since: string): Promise<Set<string>> {
  /* Pakai service_role key — trades butuh bypass RLS */
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/trades?select=user_id&created_at=gte.${encodeURIComponent(since)}&limit=1000`,
    { headers: sbHPriv(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) throw new Error(`Supabase trades HTTP ${res.status}${res.status === 401 && !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) ? ' — set SUPABASE_SERVICE_ROLE_KEY' : ''}`)
  const rows = (await res.json()) as { user_id?: string }[]
  return new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])
}

async function csoAgent(e: Env) {
  const since = isoAgo(24)
  const activeSet = await fetchActiveUserIds(e, since)
  const total = await supaCount(e, 'profiles')
  const passive = Math.max(0, total - activeSet.size)
  /* Feedback loop: user yang di-email CSO kemarin — berapa yang balik
     upload hari ini? (ID yang di-email disimpan di agent_kv saat kirim) */
  let emailed = 0, returned = 0
  try {
    const ids: string[] = JSON.parse((await kvGet(e, `csmailed:${utcDay(-1)}`)) || '[]')
    emailed = ids.length
    returned = ids.filter((id) => activeSet.has(id)).length
  } catch { /* ignore */ }
  return { title: 'CSO — Customer Success', total, active: activeSet.size, passive, emailedYesterday: emailed, returnedYesterday: returned }
}

/* ============================================================
   AGEN 3 — CMO (Marketing & Copywriter AI): Gemini native REST
   v2: CMO menganalisis KONTEN TIKTOK ASLI dari tabel tiktok_posts
   (migrasi 014 — link + caption + views/likes diisi Bos lewat
   Ruang CMO) → draf meniru pola yang TERBUKTI perform di FYP.
   Kalau tabel masih kosong → fallback ke deskripsi gaya statis
   di env TIKTOK_REFERENCE (perilaku lama).
   ============================================================ */
function fallbackDraft(angle: string): string {
  return [
    '[DRAF CADANGAN — Gemini limit/error, revisi manual]',
    'HOOK: "Trader XAUUSD, stop scroll 3 detik. Ini alasan akun lo bocor tiap minggu."',
    `ISI: ${angle}`,
    'SOLUSI: upload screenshot chart lo — biarkan evaluasi visualnya yang nuduhin kesalahan lo.',
    'CTA: "Coba gratis hari ini — link di bio." (durasi 30–40 detik)',
  ].join('\n')
}

/* 1 panggilan Gemini text. thinkingBudget: 0 — pelajaran fix
   auto-journal: thinking memakan maxOutputTokens → teks kosong. */
async function geminiText(e: Env, systemPrompt: string, userPrompt: string, maxTokens = 2048, temperature = 1.0): Promise<string> {
  const model = e.GEMINI_MODEL || 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(e.GEMINI_API_KEY || '')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: timeoutSignal(30_000),
    },
  )
  if (res.status === 429) {
    await kvIncr(e, `quota429:${utcDay()}`)
    const x: any = new Error('Gemini 429 (rate limit)'); x.status = 429
    throw x
  }
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data: any = await res.json()
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('').trim()
  if (!text) throw new Error('Gemini mengembalikan respons kosong')
  return text
}

/* 1 panggilan OpenRouter (format OpenAI — cadangan Gemini CMO).
   Butuh OPENROUTER_API_KEY. Model default: zhipu/glm-4.7 flash
   (murah, cepat, bahasa Indonesia lumayan). */
async function openRouterText(e: Env, systemPrompt: string, userPrompt: string, maxTokens = 2048): Promise<string> {
  const orKey = cleanEnv(e.OPENROUTER_API_KEY)
  if (!orKey) throw new Error('OPENROUTER_API_KEY belum diset — tambah di Cloudflare Workers Secrets')
  const model = e.OPENROUTER_MODEL || 'zhipu/glm-4.7 flash'
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${orKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
    }),
    signal: timeoutSignal(30_000),
  })
  if (res.status === 429) {
    const x: any = new Error('OpenRouter 429 (rate limit)'); x.status = 429
    throw x
  }
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data: any = await res.json()
  const text = (data?.choices?.[0]?.message?.content || '').trim()
  if (!text) throw new Error('OpenRouter mengembalikan respons kosong')
  return text
}

/* Top 5 konten TikTok milik Bos, urut views (tabel tiktok_posts).
   Butuh service_role key — tabel terkunci RLS. Gagal → [] (fallback). */
async function fetchTopTikToks(e: Env): Promise<{ url: string; caption: string; views: number; likes: number }[]> {
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) return []
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/tiktok_posts?select=url,caption,views,likes&order=views.desc&limit=5`,
    { headers: sbHPriv(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) return []
  return (await res.json()) as { url: string; caption: string; views: number; likes: number }[]
}

async function cmoAgent(e: Env) {
  const angle = ANGLES[dayIndex() % ANGLES.length]
  let history: string[] = []
  try { history = JSON.parse((await kvGet(e, 'drafts:history')) || '[]') } catch { /* ignore */ }

  /* Bahan analisis: konten asli TikTok Bos (diisi lewat Ruang CMO) */
  const posts = await fetchTopTikToks(e).catch(() => [])
  const tiktokBlock = posts.length
    ? `KONTEN TIKTOK ASLI milik CEO (urut views — paling atas TERBUKTI paling perform):\n` +
      posts.map((p, i) => `${i + 1}. [${fmtN(p.views)} views · ${fmtN(p.likes)} likes] "${(p.caption || '').slice(0, 400)}"`).join('\n')
    : ''

  const systemPrompt =
    `Kamu adalah CMO Luxtrade. ` +
    (posts.length
      ? `Analisis pola dari konten berikut: hook seperti apa yang bikin FYP, topik apa yang paling banyak ditonton, struktur & gaya bahasa khasnya. TIRU pola pemenang tersebut dalam draf baru.\n\n${tiktokBlock}`
      : `Analisis gaya bahasa, hook, dan struktur dari naskah TikTok milik CEO berikut ini: ${e.TIKTOK_REFERENCE || '(belum ada referensi — pakai gaya trader Indonesia kasual, bahasa gaul)'}`) +
    `\nTugasmu hari ini: Buat 1 draf naskah video TikTok baru yang meniru pola/gaya tersebut 100%. ` +
    `DILARANG mengulang naskah yang sama dari hari-hari sebelumnya. ` +
    `Rotasi angle harian: pain point trader XAUUSD (SMC/ICT), kelelahan ngetik jurnal manual, atau cara menjaga max daily loss prop firm dengan evaluasi visual.`

  const userPrompt =
    `Tanggal hari ini: ${wibNow()}.\n` +
    `ANGLE HARI INI (WAJIB dipakai): ${angle}\n` +
    (history.length
      ? `\nNaskah yang SUDAH dipakai hari sebelumnya (DILARANG mengulang / mirip):\n` +
        history.map((h, i) => `— draf ${i + 1} —\n${h.slice(0, 500)}`).join('\n') + '\n'
      : '') +
    (posts.length ? `\nWAJIB: ambil pola dari konten berperform terbaik di atas — bukan naskah generik.\n` : '') +
    `\nOutput: HANYA naskah TikTok baru (hook 3 detik pertama → body → CTA, durasi 30–45 detik), tanpa penjelasan tambahan.`

  /* ═══════ AUTO-FALLBACK: Gemini → OpenRouter → fallbackDraft ═══════
     1) Gemini (API utama — gratis, kualitas bagus)
     2) OpenRouter (cadangan — kalau Gemini 429/error, otomatis pindah)
     3) fallbackDraft (fail-safe terakhir — teks statis) */
  let draft: string
  let provider: 'gemini' | 'openrouter' | 'fallback' = 'fallback'
  let usedFallback = false
  let fallbackError = ''

  try {
    draft = await geminiText(e, systemPrompt, userPrompt, 2048, 1.0)
    provider = 'gemini'
  } catch (geminiErr: any) {
    fallbackError = String(geminiErr?.message || geminiErr).slice(0, 120)
    try {
      draft = await openRouterText(e, systemPrompt, userPrompt, 2048)
      provider = 'openrouter'
    } catch (orErr: any) {
      fallbackError += ' | OR: ' + String(orErr?.message || orErr).slice(0, 80)
      draft = fallbackDraft(angle)
      usedFallback = true
    }
  }

  history.unshift(draft)
  await kvSet(e, 'drafts:history', JSON.stringify(history.slice(0, 5)))
  return { draft, angle, usedFallback, provider, basedOn: posts.length ? 'tiktok' : 'reference', analyzedPosts: posts.length, ...(fallbackError ? { fallbackError } : {}) }
}

/* ============================================================
   AGEN 4 — CFO (API Quota Manager, anti-429 Gemini Vision gratis)
   ============================================================ */
async function cfoAgent(e: Env) {
  const limit = parseInt(e.DAILY_VISION_LIMIT || '1400', 10)
  const emailLimit = parseInt(e.RESEND_DAILY_LIMIT || '100', 10) // Resend free: 100 email/hari
  const read = async (k: string) => parseInt((await kvGet(e, k)) || '0', 10)
  const usedToday = await read(`quota:${utcDay(0)}`)
  const usedYesterday = await read(`quota:${utcDay(-1)}`)
  const quota429 = await read(`quota429:${utcDay(-1)}`)
  const emailToday = await read(`email:${utcDay(0)}`)
  const emailYesterday = await read(`email:${utcDay(-1)}`)
  const pct = limit > 0 ? Math.round((usedToday / limit) * 100) : 0
  const emailPct = emailLimit > 0 ? Math.round((emailToday / emailLimit) * 100) : 0
  return {
    title: 'CFO — API Quota Manager', limit, usedToday, usedYesterday, quota429,
    emailLimit, emailToday, emailYesterday, emailPct,
    status: pct >= 95 ? 'KRITIS — hentikan upload sisa hari ini'
      : pct >= 80 ? 'WASPADA — kurangi frekuensi upload'
      : 'AMAN ✅',
    emailStatus: emailPct >= 95 ? 'KRITIS — kuota email hampir habis'
      : emailPct >= 80 ? 'WASPADA — kuota email menipis'
      : 'AMAN ✅',
  }
}

/* ---------- Notifikasi Discord (pengganti WhatsApp gateway) ----------
   Hanya butuh 1 secret: DISCORD_WEBHOOK_URL (sudah diset di Cloudflare).
   Pesan memakai markdown Discord (**bold**), max 2000 char. */
async function sendDiscord(e: Env, message: string): Promise<boolean> {
  let webhookUrl = cleanEnv(e.DISCORD_WEBHOOK_URL)
  if (!webhookUrl) {
    // fallback: binding env CF Workers (OpenNext context)
    try {
      const sym = Symbol.for('__cloudflare-context__')
      const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
      webhookUrl = ctx?.env?.DISCORD_WEBHOOK_URL || ''
    } catch { /* ignore */ }
  }
  if (!webhookUrl)
    throw new Error('DISCORD_WEBHOOK_URL belum diset — Cloudflare → Workers → luxtradee → Variables & Secrets')

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'LuxTradee CEO Agent',
      content: message.slice(0, 2000), // batas hard Discord
    }),
    signal: timeoutSignal(15_000),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 120)
    throw new Error(`Discord HTTP ${res.status}${detail ? ' — ' + detail : ''}`)
  }
  return true
}

/* ---------- Morning Briefing (gabungan 4 agen) ---------- */
function buildBriefing(cto: any, cso: any, cmo: any, cfo: any, autoAcc = '', autoOn = false): string {
  const L: string[] = []
  L.push('🌅 **MORNING BRIEFING — LUXTRADE SUPER AI**')
  L.push(`📅 ${wibNow()} · 08:00 WIB`)
  L.push('━━━━━━━━━━━━━━━━━━')
  L.push('🖥️ **CTO AGENT — IT & QA**')
  L.push(cto?.siteOk
    ? `• Website: ✅ ${cto.status} OK (${cto.latencyMs} ms)`
    : `• Website: ❌ DOWN (${cto?.status || 'timeout'})${cto?.err ? ' — ' + String(cto.err).slice(0, 80) : ''}`)
  L.push(cto?.bugs24h > 0 ? `• Bug 24 jam terakhir: ${cto.bugs24h} ⚠️ segera cek bug_reports`
    : cto?.bugs24h === 0 ? '• Bug 24 jam terakhir: 0 ✅'
    : `• Bug 24 jam: gagal diambil ⚠️ ${String(cto?.err || '').slice(0, 110)}`)
  L.push('')
  L.push('👥 **CSO AGENT — CUSTOMER SUCCESS**')
  L.push(`• Total pendaftar: ${fmtN(cso?.total)}`)
  L.push(`• User aktif (upload 24 jam): ${fmtN(cso?.active)}`)
  L.push(`• User pasif (>24 jam tanpa aktivitas): ${fmtN(cso?.passive)}`)
  if (cso?.emailedYesterday > 0)
    L.push(`• Feedback email kemarin: ${fmtN(cso.returnedYesterday)}/${fmtN(cso.emailedYesterday)} user balik upload ${cso.returnedYesterday > 0 ? '✅' : '⏳'}`)
  if (cso?.err) L.push(`⚠️ CSO gagal: ${String(cso.err).slice(0, 130)}`)
  L.push('')
  L.push('📣 **CMO AGENT — DRAF TIKTOK HARI INI**')
  L.push(cmo?.draft ? `—\n${cmo.draft}\n—` : '• Gagal generate draf ⚠️')
  if (cmo?.usedFallback) L.push('_(Gemini + OpenRouter gagal — pakai draf cadangan, mohon revisi manual)_')
  else if (cmo?.provider === 'openrouter') L.push('_(Gemini gagal — otomatis pakai OpenRouter sebagai cadangan ✅)_')
  if (cmo?.basedOn === 'tiktok') L.push(`📚 Dianalisis dari ${fmtN(cmo.analyzedPosts)} konten TikTok asli lo (urut views) — pola pemenang ditiru`)
  else if (cmo?.draft) L.push('📚 Analisis pakai referensi statis — isi "Bahan Analisis TikTok" di Ruang CMO biar makin akurat')
  L.push('')
  L.push('💰 **CFO AGENT — KUOTA API GEMINI**')
  L.push(`• Terpakai kemarin: ${fmtN(cfo?.usedYesterday)}/${fmtN(cfo?.limit)}`)
  L.push(`• Terpakai hari ini: ${fmtN(cfo?.usedToday)}/${fmtN(cfo?.limit)}`)
  L.push(`• Event 429 kemarin: ${fmtN(cfo?.quota429)}`)
  L.push(`• Email terkirim hari ini: ${fmtN(cfo?.emailToday)}/${fmtN(cfo?.emailLimit)} (Resend — ${cfo?.emailStatus || '-'})`)
  L.push(`• Status: ${cfo?.status || '-'}`)
  if (cfo?.err) L.push(`⚠️ CFO gagal: ${String(cfo.err).slice(0, 130)}`)
  L.push('━━━━━━━━━━━━━━━━━━')
  if (autoAcc) L.push(autoAcc)
  L.push(autoOn
    ? '🤖 AUTO-ACC aktif — email sapaan user pasif dikirim CSO otomatis tiap pagi, Bos nggak perlu klik apa-apa.'
    : "Bos, klik tombol 'ACC EMAIL' di Ruang CEO (/kantor-ceo) jika ingin CSO mengirim email sapaan ke user pasif hari ini.")
  return L.join('\n')
}

async function runMorningBriefing(e: Env) {
  const [cto, cso, cmo, cfo] = await Promise.all([
    ctoAgent(e).catch((x: any) => ({ siteOk: false, status: 0, latencyMs: 0, bugs24h: -1, err: String(x?.message || x) })),
    csoAgent(e).catch((x: any) => ({ total: -1, active: -1, passive: -1, err: String(x?.message || x) })),
    cmoAgent(e).catch((x: any) => ({ draft: '', angle: '', usedFallback: false, error: String(x?.message || x) })),
    cfoAgent(e).catch((x: any) => ({ limit: 0, usedToday: 0, usedYesterday: 0, quota429: 0, status: 'error', err: String(x?.message || x) })),
  ])
  /* AUTO-ACC — kalau owner menyalakannya, CSO kirim email pasif OTOMATIS
     (1×/hari, dedup via agent_kv acc_email:<tanggal>). Bos tidur, karyawan kerja. */
  const autoOn = (await kvGet(e, 'autoacc')) === 'on'
  let autoAcc = ''
  if (autoOn && !(await kvGet(e, `acc_email:${utcDay()}`))) {
    await kvSet(e, `acc_email:${utcDay()}`, new Date().toISOString())
    if (e.RESEND_API_KEY) {
      try { const r = await sendPassiveEmails(e); autoAcc = `📧 AUTO-ACC: ${r.sent} email sapaan terkirim ke user pasif (otomatis, variasi "${r.variant}")` }
      catch (x: any) { autoAcc = `📧 AUTO-ACC gagal kirim: ${String(x?.message || x).slice(0, 80)}` }
    } else autoAcc = '📧 AUTO-ACC aktif tapi RESEND_API_KEY belum diset — email belum terkirim'
    try { if (autoAcc) await sendDiscord(e, autoAcc) } catch { /* ignore */ }
  }
  const text = buildBriefing(cto, cso, cmo, cfo, autoAcc, autoOn)
  let notifySent = false, notifyErr = ''
  try { await sendDiscord(e, text); notifySent = true } catch (x: any) { notifyErr = String(x?.message || x) }
  const summary = { at: new Date().toISOString(), notifySent, notifyErr, cto, cso, cmo, cfo, text }
  await kvSet(e, 'briefing:last', JSON.stringify(summary))
  return summary
}

/* ---------- flow "ACC EMAIL": email ke user pasif ----------
   v2: 3 variasi pesan (rotasi harian — anti email fatigue) +
   ID penerima dicatat di agent_kv → besok CSO hitung berapa
   yang BALIK upload setelah di-email (feedback loop nyata). */
const PASSIVE_VARIANTS = [
  {
    subject: 'Lama gak ketemu 👋',
    text: 'Hai! Kamu belum upload screenshot jurnal trading kamu dalam 24 jam terakhir.\n\nYuk evaluasi visual hari ini di https://luxtradee.web.id — cuma 2 menit.\n\n— Tim Luxtrade',
  },
  {
    subject: 'Jurnal lo masih nunggu 📈',
    text: 'Jurnal yang kosong itu kehilangan data — trade bagus hari ini bisa jadi pelajaran besok.\n\nUpload screenshot terakhir lo, 2 menit langsung dapat evaluasi visual: https://luxtradee.web.id\n\n— Tim Luxtrade',
  },
  {
    subject: 'Setup terakhir lo kapan? 🎯',
    text: 'Trader disiplin itu yang nyatet setiap entry — bukan yang hafal.\n\nBalik lagi yuk: upload 1 screenshot, biarkan AI yang evaluasi. https://luxtradee.web.id\n\n— Tim Luxtrade',
  },
]

async function sendPassiveEmails(e: Env): Promise<{ sent: number; ids: string[]; variant: string }> {
  const since = isoAgo(24)
  const activeIds = await fetchActiveUserIds(e, since)
  const variant = PASSIVE_VARIANTS[dayIndex() % PASSIVE_VARIANTS.length]

  // kandidat: profil dengan email, terbaru dulu — maks 200 kandidat
  /* Pakai service_role key — profiles butuh bypass RLS */
  const url = `${sbUrl(e)}/rest/v1/profiles?select=id,email&email=not.is.null&order=created_at.desc&limit=200`
  const res = await fetch(url, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) throw new Error(`Supabase profiles HTTP ${res.status}${res.status === 401 && !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) ? ' — set SUPABASE_SERVICE_ROLE_KEY' : ''}`)
  const profiles = (await res.json()) as { id?: string; email?: string }[]

  const targets = profiles
    .filter((p) => p.email && p.id && !activeIds.has(p.id))
    .slice(0, 50)

  let sent = 0
  const emailedIds: string[] = []
  for (const p of targets) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: p.email as string,
        subject: variant.subject,
        text: variant.text,
      }),
      signal: timeoutSignal(10_000),
    }).catch(() => null)
    if (r && (r as any).ok) {
      sent++
      emailedIds.push(p.id as string)
      await kvIncr(e, `email:${utcDay()}`).catch(() => {}) // CFO: pantau kuota Resend
    }
  }
  /* simpan siapa saja yang di-email hari ini → besok dihitung "balik aktif" */
  if (emailedIds.length) await kvSet(e, `csmailed:${utcDay()}`, JSON.stringify(emailedIds.slice(0, 50))).catch(() => {})
  return { sent, ids: emailedIds, variant: variant.subject }
}

/* ============================================================
   WATCHDOG — CTO jaga situs 24/7 (dipanggil cron tiap 15 menit)
   Cek situs + bug + kuota. Kalau ada masalah → ALARM DISCORD INSTAN
   (tidak nunggu briefing besok pagi). Kalau aman → diam saja,
   cuma catat riwayat uptime ke agent_kv.
   ============================================================ */
async function watchdog(e: Env) {
  const day = utcDay()
  const alerts: string[] = []

  /* 1) ping situs + hitung bug — pakai ctoAgent (sudah ada retry + abaikan 521-524) */
  const cto = await ctoAgent(e).catch((x: any) => ({ siteOk: false, status: 0, latencyMs: 0, bugs24h: -1, err: String(x?.message || x) }))
  await kvIncr(e, `${cto.siteOk ? 'up' : 'down'}:${day}`).catch(() => {}) // riwayat uptime

  /* site DOWN → alarm (dedup 30 menit biar nggak spam) */
  let lastDown = 0
  try { lastDown = parseInt((await kvGet(e, 'wd:down:last')) || '0', 10) } catch { /* ignore */ }
  if (!cto.siteOk && Date.now() - lastDown > 30 * 60_000) {
    await kvSet(e, 'wd:down:last', String(Date.now()))
    const msg = `🚨 **CTO WATCHDOG — WEBSITE DOWN!**\n• Status: ${cto.status || 'timeout'}\n• ${String(cto.err || '').slice(0, 150)}\nCek sekarang: https://luxtradee.web.id`
    try { await sendDiscord(e, msg); alerts.push('situs-down') } catch { /* ignore */ }
  }
  /* site pulih → kabari sekali */
  if (cto.siteOk && lastDown && Date.now() - lastDown < 2 * 3600_000) {
    const rk = `wd:recovered:${day}`
    if ((await kvGet(e, rk)) !== '1') {
      await kvSet(e, rk, '1')
      try { await sendDiscord(e, '✅ **CTO WATCHDOG** — Website kembali ONLINE! Semua normal.'); alerts.push('situs-pulih') } catch { /* ignore */ }
    }
  }

  /* 2) bug baru → alarm sekali per kenaikan angka */
  let bugsAlertedRaw: string | null = null
  try { bugsAlertedRaw = await kvGet(e, 'wd:bugs:last') } catch { /* ignore */ }
  if (cto.bugs24h >= 0) {
    if (bugsAlertedRaw == null) {
      await kvSet(e, 'wd:bugs:last', String(cto.bugs24h)) // baseline pertama, tanpa alarm
    } else if (cto.bugs24h > parseInt(bugsAlertedRaw || '0', 10)) {
      await kvSet(e, 'wd:bugs:last', String(cto.bugs24h))
      /* TRIAGE otomatis: 3 bug terakhir → Gemini ringkas jadi diagnosa
         + prioritas P1-P3 → Bos nggak perlu buka Supabase manual.
         Gemini hanya dipanggil SAAT bug baru masuk (bukan tiap 15 mnt). */
      let triage = ''
      try {
        const bres = await fetch(`${sbUrl(e)}/rest/v1/bug_reports?select=description&order=created_at.desc&limit=3`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
        const bugs: { description?: string }[] = bres.ok ? await bres.json() : []
        const list = bugs.map((b, i) => `${i + 1}. ${String(b.description || '').replace(/\s+/g, ' ').slice(0, 300)}`).filter((s) => s.length > 3).join('\n')
        if (list) {
          if (e.GEMINI_API_KEY) {
            triage = await geminiText(
              e,
              'Kamu CTO Luxtradee (web app jurnal trading). Ringkas laporan bug user jadi diagnosa singkat & actionable. Format per baris: "- [P1/P2/P3] masalah → kemungkinan penyebab/lokasi". P1=kritis (situs/fitur utama mati), P2=gangguan, P3=minor. Satu baris per bug, tanpa pembuka/penutup.',
              `Laporan bug terbaru:\n${list}`,
              512, 0.3,
            )
          } else triage = list
        }
      } catch { /* triage opsional — gagal → kirim alarm tanpa detail */ }
      const msg = `🐞 **CTO WATCHDOG — BUG BARU MASUK!**\n• Total 24 jam: ${cto.bugs24h} bug\n${triage ? triage.slice(0, 900) + '\n' : ''}Segera cek tabel bug_reports di Supabase.`
      try { await sendDiscord(e, msg); alerts.push('bug-baru') } catch { /* ignore */ }
    }
  }

  /* 3) kuota Gemini >= 80% → alarm 1×/hari */
  const cfo = await cfoAgent(e).catch(() => null)
  let quota = ''
  if (cfo && cfo.limit > 0) {
    quota = `${cfo.usedToday}/${cfo.limit}`
    const pct = Math.round((cfo.usedToday / cfo.limit) * 100)
    let flagged = ''
    try { flagged = (await kvGet(e, `wd:quota:${day}`)) || '' } catch { /* ignore */ }
    if (pct >= 80 && flagged !== 'sent') {
      await kvSet(e, `wd:quota:${day}`, 'sent')
      const msg = `💰 **CFO WATCHDOG — KUOTA ${pct}% TERPAKAI**\n• ${cfo.usedToday}/${cfo.limit} request hari ini\n• Status: ${cfo.status}`
      try { await sendDiscord(e, msg); alerts.push('kuota-80') } catch { /* ignore */ }
    }
  }

  return { watch: true, at: new Date().toISOString(), siteOk: cto.siteOk, status: cto.status, bugs24h: cto.bugs24h, quota, alerts }
}

/* ============================================================
   LAPORAN MINGGUAN — CEO rekap 7 hari ke Discord
   (dipanggil cron Minggu malam, mis. 20:00 WIB)
   ============================================================ */
async function weeklyReport(e: Env) {
  const L: string[] = []
  L.push('📊 **LAPORAN MINGGUAN — LUXTRADE SUPER AI**')
  L.push(`📅 ${wibNow()}`)
  L.push('━━━━━━━━━━━━━━━━━━')

  /* CSO — pertumbuhan user 7 hari */
  try {
    const since7 = isoAgo(24 * 7)
    const total = await supaCount(e, 'profiles')
    const baru7 = await supaCount(e, 'profiles', 'created_at=gte.' + since7)
    const active7 = (await fetchActiveUserIds(e, since7)).size
    L.push('👥 **CSO — Pertumbuhan 7 hari**')
    L.push(`• Total pendaftar: ${fmtN(total)} (baru minggu ini: +${fmtN(baru7)})`)
    L.push(`• Aktif (upload 7 hari): ${fmtN(active7)}`)
    L.push(`• Pasif: ${fmtN(Math.max(0, total - active7))}`)
  } catch (x: any) { L.push(`⚠️ Data user gagal diambil: ${String(x?.message || x).slice(0, 90)}`) }

  /* CTO — bug & uptime */
  let bugs7 = -1
  try { bugs7 = await supaCount(e, 'bug_reports', 'created_at=gte.' + isoAgo(24 * 7)) } catch { /* ignore */ }
  L.push('🖥️ **CTO — Kualitas & Uptime 7 hari**')
  L.push(bugs7 >= 0 ? `• Bug masuk minggu ini: ${bugs7} ${bugs7 > 0 ? '⚠️' : '✅'}` : '• Bug: gagal diambil')
  let up = 0, down = 0
  for (let i = 0; i < 7; i++) {
    const d = utcDay(-i)
    try {
      up += parseInt((await kvGet(e, `up:${d}`)) || '0', 10)
      down += parseInt((await kvGet(e, `down:${d}`)) || '0', 10)
    } catch { /* ignore */ }
  }
  const cek = up + down
  if (cek > 0) L.push(`• Uptime (hasil watchdog): ${Math.round((up / cek) * 100)}% — ${up}/${cek} cek OK`)
  else L.push('• Uptime: belum ada data watchdog (set cron action=watchdog tiap 15 mnt)')

  /* CFO — pemakaian kuota 7 hari */
  let q7 = 0
  for (let i = 0; i < 7; i++) { try { q7 += parseInt((await kvGet(e, `quota:${utcDay(-i)}`)) || '0', 10) } catch { /* ignore */ } }
  const limit = parseInt(e.DAILY_VISION_LIMIT || '1400', 10)
  L.push('💰 **CFO — Pemakaian Kuota Gemini**')
  L.push(`• Total 7 hari: ${fmtN(q7)} request (rata-rata ${fmtN(Math.round(q7 / 7))}/hari · limit harian ${fmtN(limit)})`)

  /* COO — konversi jualan: lead yang di-email minggu ini → sudah PRO? */
  try {
    const resT = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_tasks?agent_type=eq.COO&status=eq.approved&executed_at=gte.${encodeURIComponent(isoAgo(24 * 7))}&select=target_user_id`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    const rows: { target_user_id?: string }[] = resT.ok ? await resT.json() : []
    const ids = [...new Set(rows.map((r) => r.target_user_id).filter(Boolean) as string[])]
    if (ids.length) {
      let pro = 0
      const resP = await fetch(`${sbUrl(e)}/rest/v1/profiles?select=is_pro&id=in.(${ids.map((i) => `"${i}"`).join(',')})`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
      const profs: { is_pro?: boolean }[] = resP.ok ? await resP.json() : []
      pro = profs.filter((p) => p.is_pro).length
      L.push(`💼 **COO — Jualan 7 hari**: ${ids.length} penawaran PRO terkirim → ${pro} lead sudah PRO (${Math.round((pro / ids.length) * 100)}% konversi)${pro > 0 ? ' 🎉' : ''}`)
    } else L.push('💼 **COO — Jualan 7 hari**: belum ada penawaran terkirim minggu ini')
  } catch { L.push('💼 **COO — Jualan 7 hari**: data gagal diambil') }

  /* Email Resend — pemakaian 7 hari (free tier ±3.000/bulan) */
  let em7 = 0
  for (let i = 0; i < 7; i++) { try { em7 += parseInt((await kvGet(e, `email:${utcDay(-i)}`)) || '0', 10) } catch { /* ignore */ } }
  L.push(`📧 **Email Resend 7 hari**: ${fmtN(em7)} terkirim`)

  L.push('━━━━━━━━━━━━━━━━━━')
  L.push('🤖 Laporan otomatis dari karyawan AI — Bos tinggal baca.')
  const text = L.join('\n')
  let notifySent = false, notifyErr = ''
  try { await sendDiscord(e, text); notifySent = true } catch (x: any) { notifyErr = String(x?.message || x) }
  await kvSet(e, 'weekly:last', JSON.stringify({ at: new Date().toISOString(), notifySent, notifyErr, text }))
  return { weekly: true, notifySent, notifyErr, text }
}

/* ============================================================
   BAHAN ANALISIS TIKTOK — CRUD tabel tiktok_posts (migrasi 014)
   Dipakai Ruang CMO: Bos paste link + views/likes → caption
   diambil OTOMATIS via TikTok oEmbed (gratis, tanpa API key).
   ============================================================ */
async function tikTokList(e: Env) {
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('set SUPABASE_SERVICE_ROLE_KEY dulu di Cloudflare (butuh bypass RLS)')
  const res = await fetch(`${sbUrl(e)}/rest/v1/tiktok_posts?select=id,url,caption,thumbnail_url,views,likes,comments,posted_at&order=views.desc&limit=100`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 160)
    throw new Error(`tiktok_posts HTTP ${res.status}${detail ? ' — ' + detail : ''}${detail.includes('does not exist') ? ' — jalankan supabase-migrations/014_create_tiktok_posts.sql dulu' : ''}`)
  }
  return { posts: await res.json() }
}

async function tikTokAdd(e: Env, body: { url?: string; views?: number; likes?: number; comments?: number; caption?: string }) {
  const postUrl = String(body.url || '').trim()
  if (!/^https:\/\/(www\.)?tiktok\.com\//.test(postUrl)) throw new Error('URL TikTok tidak valid — contoh: https://www.tiktok.com/@username/video/123456789')
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('set SUPABASE_SERVICE_ROLE_KEY dulu di Cloudflare (butuh bypass RLS)')

  /* oEmbed TikTok: gratis, tanpa API key → caption + thumbnail otomatis */
  let caption = String(body.caption || '').trim()
  let thumbnail = ''
  let autoCaption = false
  try {
    const oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`, { signal: timeoutSignal(10_000) })
    if (oe.ok) {
      const d: any = await oe.json()
      const t = String(d?.title || '').trim()
      if (t) { caption = caption || t; autoCaption = !body.caption }
      thumbnail = String(d?.thumbnail_url || '')
    }
  } catch { /* oEmbed gagal → pakai caption manual dari Bos */ }

  const row = {
    url: postUrl,
    caption: caption || '(caption kosong)',
    thumbnail_url: thumbnail,
    views: Math.max(0, Math.round(Number(body.views) || 0)),
    likes: Math.max(0, Math.round(Number(body.likes) || 0)),
    comments: Math.max(0, Math.round(Number(body.comments) || 0)),
  }
  const res = await fetch(`${sbUrl(e)}/rest/v1/tiktok_posts?on_conflict=url`, {
    method: 'POST',
    headers: { ...sbHPriv(e), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
    signal: timeoutSignal(10_000),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 160)
    throw new Error(`Simpan gagal HTTP ${res.status}${detail ? ' — ' + detail : ''}${detail.includes('does not exist') ? ' — jalankan supabase-migrations/014_create_tiktok_posts.sql dulu' : ''}`)
  }
  const saved: any = await res.json()
  return { ok: true, post: Array.isArray(saved) ? saved[0] : saved, captionAuto: autoCaption }
}

async function tikTokDel(e: Env, id: string) {
  if (!id) throw new Error('id wajib diisi')
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('set SUPABASE_SERVICE_ROLE_KEY dulu di Cloudflare (butuh bypass RLS)')
  const res = await fetch(`${sbUrl(e)}/rest/v1/tiktok_posts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) throw new Error(`Hapus gagal HTTP ${res.status}`)
  return { ok: true, deleted: id }
}

/* ============================================================
   ROUTING (pengganti Hono — satu route, banyak action)
   ============================================================ */
const j = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } })

async function handle(req: Request): Promise<Response> {
  const e = env()
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'info'
  const key = url.searchParams.get('key') || ''
  const auth = req.headers.get('authorization') || ''
  const isCron = !!e.CRON_SECRET && (key === e.CRON_SECRET || auth === `Bearer ${e.CRON_SECRET}`)
  const isAdmin = !!e.ADMIN_SECRET && (auth === `Bearer ${e.ADMIN_SECRET}` || key === e.ADMIN_SECRET)
  /* Fallback konsisten dengan route /api/cron/*: kalau CRON_SECRET dan
     ADMIN_SECRET dua-duanya belum diset di Worker, izinkan cron internal
     berjalan (mode tanpa secret). Begitu salah satu diset, auth wajib. */
  const noSecrets = !cleanEnv(e.CRON_SECRET) && !cleanEnv(e.ADMIN_SECRET)

  /* Browser mengirim anon key PUBLIK miliknya (yang terbukti jalan — dipakai
     seluruh situs). Env SUPABASE_ANON_KEY yang salah di Cloudflare tertimpa
     di sini, jadi query data & verifikasi email tetap hidup. Anon key memang
     publik — keamanan tetap di email-gate JWT di bawah. */
  const hKey = cleanEnv(req.headers.get('x-sb-key') || '')
  if (hKey.length > 20) (e as Record<string, string>).SUPABASE_ANON_KEY = hKey

  /* Email-gate: Bearer token = sesi login Supabase user.
     Cukup email owner (default luxtradee@gmail.com) — tanpa perlu secret apa pun. */
  let isOwner = false
  if (!isAdmin && auth.startsWith('Bearer ')) {
    const tok = auth.slice(7).trim()
    if (tok && tok !== e.ADMIN_SECRET && tok !== e.CRON_SECRET)
      isOwner = await verifyOwnerToken(e, tok)
  }

  if (action !== 'info' && !(isCron || isAdmin || isOwner || noSecrets))
    return j({ error: 'unauthorized — login sebagai ' + ownerEmail(e) + ' di situs, atau pakai ?key=CRON_SECRET / header Authorization: Bearer <ADMIN_SECRET>' }, 401)

  if (action !== 'info' && action !== 'quota' && action !== 'briefing-last') {
    const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'].filter(k => (k === 'SUPABASE_URL' && !sbUrl(e)) || (k === 'SUPABASE_ANON_KEY' && !sbAnonKey(e)))
    if (missing.length) return j({ error: 'ENV belum diset: ' + missing.join(', ') }, 500)
  }

  switch (action) {
    case 'briefing':
      return j(await runMorningBriefing(e))
    case 'briefing-last': {
      const raw = await kvGet(e, 'briefing:last')
      return raw ? j(JSON.parse(raw)) : j({ error: 'belum ada briefing' }, 404)
    }
    case 'agents': {
      // ?only=cto,cso,cfo — jalankan subset agen (hemat kuota Gemini saat
      // dashboard dibuka; draf TikTok CMO hanya dibuat kalau diminta)
      const only = (url.searchParams.get('only') || '').split(',').map((s) => s.trim()).filter(Boolean)
      const want = (w: string) => !only.length || only.includes(w)
      const [cto, cso, cmo, cfo] = await Promise.all([
        want('cto') ? ctoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cso') ? csoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cmo') ? cmoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cfo') ? cfoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
      ])
      return j({ cto, cso, cmo, cfo })
    }
    case 'diag': {
      // Diagnostik sistem untuk Ruang CTO — periksa env + tes tiap query
      const has = (k: string) => !!cleanEnv(e[k])
      const out: Record<string, unknown> = {
        at: new Date().toISOString(),
        sbUrl: sbUrl(e),
        env: {
          SUPABASE_ANON_KEY: has('SUPABASE_ANON_KEY') || has('NEXT_PUBLIC_SUPABASE_ANON_KEY') || !!INLINED_SB_KEY,
        SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY'),
          GEMINI_API_KEY: has('GEMINI_API_KEY'),
          RESEND_API_KEY: has('RESEND_API_KEY'),
          DISCORD_WEBHOOK_URL: has('DISCORD_WEBHOOK_URL'),
          CRON_SECRET: has('CRON_SECRET'),
          ADMIN_SECRET: has('ADMIN_SECRET'),
          OWNER_EMAIL: has('OWNER_EMAIL'),
        },
      }
      const t = async (name: string, fn: () => Promise<unknown>) => {
        try { out[name] = { ok: true, data: await fn() } }
        catch (x: any) { out[name] = { ok: false, error: String(x?.message || x).slice(0, 200) } }
      }
      await t('profiles', async () => ({ total: await supaCount(e, 'profiles') }))
      await t('trades', async () => ({ active24h: (await fetchActiveUserIds(e, isoAgo(24))).size }))
      await t('bug_reports', async () => ({ total24h: await supaCount(e, 'bug_reports', 'created_at=gte.' + isoAgo(24)) }))
      await t('agent_kv', async () => ({ briefingLastTersimpan: !!(await kvGet(e, 'briefing:last')) }))
      return j(out)
    }
    case 'quota':
      return j(await cfoAgent(e))
    case 'quota-track': {
      const limit = parseInt(e.DAILY_VISION_LIMIT || '1400', 10)
      const k = `quota:${utcDay()}`
      const used = parseInt((await kvGet(e, k)) || '0', 10)
      if (used >= limit)
        return j({ allowed: false, usedToday: used, limit, reason: 'kuota harian habis — tunda upload ke besok (anti 429)' }, 429)
      await kvSet(e, k, String(used + 1))
      return j({ allowed: true, usedToday: used + 1, remaining: limit - used - 1, limit })
    }
    case 'acc-email': {
      // Flow "ACC EMAIL" — dipicu tombol di dashboard CEO (owner login)
      const day = utcDay()
      if (await kvGet(e, `acc_email:${day}`)) return j({ ok: true, dup: true })
      await kvSet(e, `acc_email:${day}`, new Date().toISOString())
      let emailsSent = -1
      if (e.RESEND_API_KEY) { try { emailsSent = (await sendPassiveEmails(e)).sent } catch { /* ignore */ } }
      const reply = emailsSent >= 0
        ? `Siap Bos! ✅ Email sapaan terkirim ke ${emailsSent} user pasif hari ini.`
        : 'Siap Bos! ✅ ACC EMAIL dicatat. Set RESEND_API_KEY agar email terkirim otomatis.'
      try { await sendDiscord(e, reply) } catch { /* ignore */ }
      return j({ ok: true, accEmail: true, emailsSent })
    }
    case 'discord-test':
      // Diagnosa: kirim pesan tes ke Discord, laporkan hasil mentahnya
      try {
        await sendDiscord(e, '🧪 Tes Ruang CEO — koneksi Discord webhook OK ✅')
        return j({ ok: true, message: 'tes terkirim — cek channel Discord' })
      } catch (x: any) {
        return j({ ok: false, error: String(x?.message || x) })
      }
    case 'watchdog':
      // CTO jaga situs 24/7 — Cloudflare cron tiap 15 menit (worker-entry.ts):
      // /api/ceo-agent?action=watchdog&key=CRON_SECRET
      return j(await watchdog(e))
    case 'weekly':
      // Laporan mingguan — Cloudflare cron Senin 10:00 WIB (worker-entry.ts):
      // /api/ceo-agent?action=weekly&key=CRON_SECRET
      return j(await weeklyReport(e))
    case 'auto-acc': {
      // Toggle mode otomatis: kalau ON, CSO kirim email pasif otomatis tiap briefing pagi.
      // GET = baca status · POST ?on=1 / ?on=0 = ubah
      const cur = (await kvGet(e, 'autoacc')) === 'on'
      const p = url.searchParams.get('on')
      if (p === '1' || p === '0') {
        await kvSet(e, 'autoacc', p === '1' ? 'on' : 'off')
        const msg = p === '1'
          ? '🤖 AUTO-ACC DIAKTIFKAN — CSO kirim email ke user pasif OTOMATIS tiap briefing pagi. Bos nggak perlu klik lagi.'
          : '🤖 AUTO-ACC dimatikan — ACC EMAIL kembali manual lewat Ruang CEO.'
        try { await sendDiscord(e, msg) } catch { /* ignore */ }
        return j({ set: true, autoacc: p === '1' })
      }
      return j({ autoacc: cur })
    }
    case 'tiktok-list':
      // Bahan analisis TikTok untuk CMO (Ruang CMO) — list semua post
      try { return j(await tikTokList(e)) } catch (x: any) { return j({ error: String(x?.message || x) }, 500) }
    case 'tiktok-add':
      // Tambah post: { url, views, likes, comments?, caption? } — caption
      // diambil otomatis via oEmbed kalau Bos tidak isi manual
      try {
        const body = await req.json().catch(() => ({}) as Record<string, unknown>)
        return j(await tikTokAdd(e, body as { url?: string; views?: number; likes?: number; comments?: number; caption?: string }))
      } catch (x: any) { return j({ error: String(x?.message || x) }, 400) }
    case 'tiktok-del':
      // Hapus post bahan analisis: ?id=<uuid>
      try { return j(await tikTokDel(e, url.searchParams.get('id') || '')) } catch (x: any) { return j({ error: String(x?.message || x) }, 400) }
    default:
      return j({
        app: 'Luxtrade Super AI Agent',
        notify: 'Discord webhook (DISCORD_WEBHOOK_URL)',
        owner: ownerEmail(e),
        actions: [
          'action=briefing (POST/GET) — jalankan 4 agen + kirim laporan ke Discord',
          'action=agents[&only=cto,cso,cfo] — data agen (subset via only)',
          'action=diag — diagnostik env & tes query Supabase (Ruang CTO)',
          'action=quota — laporan kuota (CFO)',
          'action=quota-track (POST) — gerbang anti-429 sebelum Gemini Vision',
          'action=briefing-last — briefing terakhir',
          'action=acc-email (POST/GET) — flow "ACC EMAIL": email sapaan ke user pasif (Resend)',
          'action=auto-acc [POST &on=1|0] — toggle kirim email pasif OTOMATIS tiap briefing pagi',
          'action=watchdog — CTO jaga situs 24/7: DOWN/bug/kuota 80% → alarm Discord instan + triage bug otomatis (cron 15 mnt)',
          'action=weekly — laporan mingguan 7 hari ke Discord (cron Minggu 20:00)',
          'action=tiktok-list — daftar bahan analisis TikTok (Ruang CMO)',
          'action=tiktok-add (POST JSON {url,views,likes}) — tambah post: caption auto via oEmbed',
          'action=tiktok-del (?id=) — hapus post bahan analisis',
          'action=discord-test — kirim pesan tes ke Discord (diagnosa)',
        ],
      })
  }
}

export const GET = handle
export const POST = handle
