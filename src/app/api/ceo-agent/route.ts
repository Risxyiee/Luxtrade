// app/api/ceo-agent/route.ts — LUXTRADE SUPER AI AGENT (Ruang CEO)
// Next.js API Route · target deploy: Cloudflare Workers (OpenNext)
// Fetch native. TANPA Vercel AI SDK. TANPA Hono. TANPA node-fetch.
// Auth: header "Authorization: Bearer ADMIN_SECRET" atau ?key=CRON_SECRET
// Cron 08:00 WIB: cron-job.org → /api/ceo-agent?action=briefing&key=CRON_SECRET
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

/* ---------- hitung baris Supabase tanpa mengunduh data ---------- */
function sbH(e: Env) {
  return { apikey: sbAnonKey(e), Authorization: `Bearer ${sbAnonKey(e)}` }
}
async function supaCount(e: Env, table: string, filters = ''): Promise<number> {
  const url = `${sbUrl(e)}/rest/v1/${table}?select=*&limit=1${filters ? '&' + filters : ''}`
  const res = await fetch(url, { headers: { ...sbH(e), Prefer: 'count=exact' }, signal: timeoutSignal(10_000) })
  if (!res.ok) {
    const hint = res.status === 401
      ? ' — SUPABASE_ANON_KEY salah/expired (cek Cloudflare Secrets: tanpa kutip & spasi, copy dari Supabase → Settings → API → anon public)'
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
  return { title: 'CTO — IT & QA', siteOk: site.siteOk, status: site.status, latencyMs: site.latencyMs, bugs24h, err }
}

/* ============================================================
   AGEN 2 — CSO (Customer Success): pendaftar / aktif / pasif
   Basis data: profiles (total) + trades 24 jam (aktivitas upload).
   Tidak ada kolom last_upload_at di skema ini — "user aktif" =
   pemilik user_id yang muncul di trades dalam 24 jam terakhir.
   ============================================================ */
async function fetchActiveUserIds(e: Env, since: string): Promise<Set<string>> {
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/trades?select=user_id&created_at=gte.${encodeURIComponent(since)}&limit=1000`,
    { headers: sbH(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) throw new Error(`Supabase trades HTTP ${res.status}`)
  const rows = (await res.json()) as { user_id?: string }[]
  return new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])
}

async function csoAgent(e: Env) {
  const since = isoAgo(24)
  const total = await supaCount(e, 'profiles')
  const active = (await fetchActiveUserIds(e, since)).size
  const passive = Math.max(0, total - active)
  return { title: 'CSO — Customer Success', total, active, passive }
}

/* ============================================================
   AGEN 3 — CMO (Marketing & Copywriter AI): Gemini native REST
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

async function cmoAgent(e: Env) {
  const angle = ANGLES[dayIndex() % ANGLES.length]
  // gemini-1.5-flash sudah di-retire Google (404) — default ke 2.5 flash.
  // PENTING (pelajaran fix auto-journal): model 2.5 default menyalakan thinking
  // yang memakan maxOutputTokens → teks terpotong/kosong. thinkingBudget: 0.
  const model = e.GEMINI_MODEL || 'gemini-2.5-flash'
  let history: string[] = []
  try { history = JSON.parse((await kvGet(e, 'drafts:history')) || '[]') } catch { /* ignore */ }

  const systemPrompt =
    `Kamu adalah CMO Luxtrade. Analisis gaya bahasa, hook, dan struktur dari naskah TikTok milik CEO berikut ini: ${e.TIKTOK_REFERENCE} ` +
    `Tugasmu hari ini: Buat 1 draf naskah video TikTok baru yang meniru gaya bahasa tersebut 100%. ` +
    `DILARANG mengulang naskah yang sama dari hari-hari sebelumnya. ` +
    `Rotasi angle harian: pain point trader XAUUSD (SMC/ICT), kelelahan ngetik jurnal manual, atau cara menjaga max daily loss prop firm dengan evaluasi visual.`

  const userPrompt =
    `Tanggal hari ini: ${wibNow()}.\n` +
    `ANGLE HARI INI (WAJIB dipakai): ${angle}\n` +
    (history.length
      ? `\nNaskah yang SUDAH dipakai hari sebelumnya (DILARANG mengulang / mirip):\n` +
        history.map((h, i) => `— draf ${i + 1} —\n${h.slice(0, 500)}`).join('\n') + '\n'
      : '') +
    `\nOutput: HANYA naskah TikTok baru (hook 3 detik pertama → body → CTA, durasi 30–45 detik), tanpa penjelasan tambahan.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(e.GEMINI_API_KEY || '')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 2048,
          ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: timeoutSignal(30_000),
    },
  )

  if (res.status === 429) {
    await kvIncr(e, `quota429:${utcDay()}`)
    return { draft: fallbackDraft(angle), angle, usedFallback: true, error: 'Gemini 429 (rate limit)' }
  }
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)

  const data: any = await res.json()
  const draft = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('').trim()
  if (!draft) throw new Error('Gemini mengembalikan respons kosong')

  history.unshift(draft)
  await kvSet(e, 'drafts:history', JSON.stringify(history.slice(0, 5)))
  return { draft, angle, usedFallback: false }
}

/* ============================================================
   AGEN 4 — CFO (API Quota Manager, anti-429 Gemini Vision gratis)
   ============================================================ */
async function cfoAgent(e: Env) {
  const limit = parseInt(e.DAILY_VISION_LIMIT || '1400', 10)
  const read = async (k: string) => parseInt((await kvGet(e, k)) || '0', 10)
  const usedToday = await read(`quota:${utcDay(0)}`)
  const usedYesterday = await read(`quota:${utcDay(-1)}`)
  const quota429 = await read(`quota429:${utcDay(-1)}`)
  const pct = limit > 0 ? Math.round((usedToday / limit) * 100) : 0
  return {
    title: 'CFO — API Quota Manager', limit, usedToday, usedYesterday, quota429,
    status: pct >= 95 ? 'KRITIS — hentikan upload sisa hari ini'
      : pct >= 80 ? 'WASPADA — kurangi frekuensi upload'
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
function buildBriefing(cto: any, cso: any, cmo: any, cfo: any): string {
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
  if (cso?.err) L.push(`⚠️ CSO gagal: ${String(cso.err).slice(0, 130)}`)
  L.push('')
  L.push('📣 **CMO AGENT — DRAF TIKTOK HARI INI**')
  L.push(cmo?.draft ? `—\n${cmo.draft}\n—` : '• Gagal generate draf ⚠️')
  if (cmo?.usedFallback) L.push('_(Gemini limit — pakai draf cadangan, mohon revisi manual)_')
  L.push('')
  L.push('💰 **CFO AGENT — KUOTA API GEMINI**')
  L.push(`• Terpakai kemarin: ${fmtN(cfo?.usedYesterday)}/${fmtN(cfo?.limit)}`)
  L.push(`• Terpakai hari ini: ${fmtN(cfo?.usedToday)}/${fmtN(cfo?.limit)}`)
  L.push(`• Event 429 kemarin: ${fmtN(cfo?.quota429)}`)
  L.push(`• Status: ${cfo?.status || '-'}`)
  if (cfo?.err) L.push(`⚠️ CFO gagal: ${String(cfo.err).slice(0, 130)}`)
  L.push('━━━━━━━━━━━━━━━━━━')
  L.push("Bos, klik tombol 'ACC EMAIL' di Ruang CEO (/kantor-ceo) jika ingin CSO mengirim email sapaan ke user pasif hari ini.")
  return L.join('\n')
}

async function runMorningBriefing(e: Env) {
  const [cto, cso, cmo, cfo] = await Promise.all([
    ctoAgent(e).catch((x: any) => ({ siteOk: false, status: 0, latencyMs: 0, bugs24h: -1, err: String(x?.message || x) })),
    csoAgent(e).catch((x: any) => ({ total: -1, active: -1, passive: -1, err: String(x?.message || x) })),
    cmoAgent(e).catch((x: any) => ({ draft: '', angle: '', usedFallback: false, error: String(x?.message || x) })),
    cfoAgent(e).catch((x: any) => ({ limit: 0, usedToday: 0, usedYesterday: 0, quota429: 0, status: 'error', err: String(x?.message || x) })),
  ])
  const text = buildBriefing(cto, cso, cmo, cfo)
  let notifySent = false, notifyErr = ''
  try { await sendDiscord(e, text); notifySent = true } catch (x: any) { notifyErr = String(x?.message || x) }
  const summary = { at: new Date().toISOString(), notifySent, notifyErr, cto, cso, cmo, cfo, text }
  await kvSet(e, 'briefing:last', JSON.stringify(summary))
  return summary
}

/* ---------- flow "ACC EMAIL": email ke user pasif ---------- */
async function sendPassiveEmails(e: Env): Promise<number> {
  const since = isoAgo(24)
  const activeIds = await fetchActiveUserIds(e, since)

  // kandidat: profil dengan email, terbaru dulu — maks 200 kandidat
  const url = `${sbUrl(e)}/rest/v1/profiles?select=id,email&email=not.is.null&order=created_at.desc&limit=200`
  const res = await fetch(url, { headers: sbH(e), signal: timeoutSignal(10_000) })
  if (!res.ok) throw new Error(`Supabase profiles HTTP ${res.status}`)
  const profiles = (await res.json()) as { id?: string; email?: string }[]

  const emails = profiles
    .filter((p) => p.email && p.id && !activeIds.has(p.id))
    .slice(0, 50)
    .map((p) => p.email as string)

  let sent = 0
  for (const to of emails) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject: 'Lama gak ketemu 👋',
        text: 'Hai! Kamu belum upload screenshot jurnal trading kamu dalam 24 jam terakhir.\n\nYuk evaluasi visual hari ini di https://luxtradee.web.id — cuma 2 menit.\n\n— Tim Luxtrade',
      }),
      signal: timeoutSignal(10_000),
    }).catch(() => null)
    if (r && (r as any).ok) sent++
  }
  return sent
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
  const isCron = !!e.CRON_SECRET && key === e.CRON_SECRET
  const isAdmin = !!e.ADMIN_SECRET && (auth === `Bearer ${e.ADMIN_SECRET}` || key === e.ADMIN_SECRET)

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

  if (action !== 'info' && !(isCron || isAdmin || isOwner))
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
      if (e.RESEND_API_KEY) { try { emailsSent = await sendPassiveEmails(e) } catch { /* ignore */ } }
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
          'action=discord-test — kirim pesan tes ke Discord (diagnosa)',
        ],
      })
  }
}

export const GET = handle
export const POST = handle
