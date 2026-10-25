// app/api/ceo-agent/route.ts — LUXTRADE SUPER AI AGENT (Ruang CEO)
// Next.js API Route · target deploy: Cloudflare Workers (OpenNext)
// Fetch native. TANPA Vercel AI SDK. TANPA Hono. TANPA node-fetch.
// Auth: header "Authorization: Bearer ADMIN_SECRET" atau ?key=CRON_SECRET
// Cron 08:00 WIB: Cloudflare cron trigger (worker-entry.ts) → /api/ceo-agent?action=briefing&key=CRON_SECRET
// (cron-job.org TIDAK diperlukan lagi — semua otomatis lewat trigger Workers bawaan)
// ARSITEKTUR MULTI-AGENT (SOP Bos): tiap karyawan pakai model OpenRouter
// sendiri — Bagas COO (llama-3.1-8b, di /api/cron/ai-coo-agent), Raka CTO
// (qwen-2.5-coder-7b), Maya CSO (gemma-2-9b), Sinta CMO (glm-4.7-flash),
// Alexander CEO (llama-3.1-8b), Putri CFO TANPA LLM (murni matematika).
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
   MEMORI KANTOR — memori bersama antar semua agen (agent_kv).
   Setiap karyawan yang baru menarik kesimpulan MENULISnya di sini;
   prompt karyawan lain memuat catatan terbaru → tim belajar
   bersama (CMO tahu temuan Dewi, COO tahu hasil email CSO, dst).
   ============================================================ */
interface MemEntry { at: string; who: string; text: string }

async function memAdd(e: Env, who: string, text: string): Promise<void> {
  try {
    let list: MemEntry[] = []
    try { list = JSON.parse((await kvGet(e, 'mem:list')) || '[]') } catch { /* reset kalau korup */ }
    list.unshift({ at: new Date().toISOString(), who, text: String(text).replace(/\s+/g, ' ').trim().slice(0, 190) })
    await kvSet(e, 'mem:list', JSON.stringify(list.slice(0, 24))).catch(() => {})
  } catch { /* memori opsional — jangan ganggu alur utama */ }
}

async function memList(e: Env): Promise<MemEntry[]> {
  try { return JSON.parse((await kvGet(e, 'mem:list')) || '[]') as MemEntry[] } catch { return [] }
}

/* Blok teks buat prompt LLM — karyawan jadi tahu temuan rekan kerja */
async function memBlock(e: Env, max = 8): Promise<string> {
  const list = await memList(e)
  if (!list.length) return ''
  return '\nMEMORI KANTOR (catatan terbaru dari rekan kerja — pertimbangkan ini, JANGAN ulangi kesimpulan yang sama persis):\n' +
    list.slice(0, max).map((m) => `- [${(m.at || '').slice(5, 10)} ${m.who}] ${m.text}`).join('\n')
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

/* ============================================================
   ALOKASI MODEL MULTI-AGENT (SOP Bos) — tiap karyawan punya model
   OpenRouter masing-masing sesuai keahliannya:
   • Bagas  (COO)  → meta-llama/llama-3.1-8b-instruct:free (route ai-coo-agent)
   • Raka   (CTO)  → qwen/qwen-2.5-coder-7b-instruct:free
   • Maya   (CSO)  → google/gemma-2-9b-it:free
   • Sinta  (CMO)  → zhipu/glm-4.7-flash (cadangan resmi: zhipu/glm-4-flash)
   • Putri  (CFO)  → TANPA LLM — murni matematika hardcoded
   • Alexander (CEO) → meta-llama/llama-3.1-8b-instruct:free
   • Dewi   (DA)   → google/gemma-2-9b-it:free (mingguan, tidak bentrok Maya)
   • Farhan (GH)   → meta-llama/llama-3.1-8b-instruct:free (mingguan)
   Override per karyawan tanpa ubah kode: env OR_MODEL_CTO (contoh).
   ============================================================ */
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'
type AgentKey = 'coo' | 'cto' | 'cso' | 'cmo' | 'ceo' | 'da' | 'gh'
const AGENT_MODELS: Record<AgentKey, string> = {
  coo: 'meta-llama/llama-3.1-8b-instruct:free',
  cto: 'qwen/qwen-2.5-coder-7b-instruct:free',
  cso: 'google/gemma-2-9b-it:free',
  cmo: 'zhipu/glm-4.7-flash',
  ceo: 'meta-llama/llama-3.1-8b-instruct:free',
  da: 'google/gemma-2-9b-it:free',
  gh: 'meta-llama/llama-3.1-8b-instruct:free',
}
/* Cadangan resmi seluruh tim kalau model utama karyawan error/429
   (SOP Bos: fallback Sinta ke zhipu/glm-4-flash). */
const OR_TEAM_FALLBACK = 'zhipu/glm-4-flash'

function orChain(e: Env, agent: AgentKey): string[] {
  const override = cleanEnv(e[`OR_MODEL_${agent.toUpperCase()}`])
  /* Legacy env OPENROUTER_MODEL masih dihormati sebagai pilihan utama Sinta */
  const primary = override || (agent === 'cmo' ? cleanEnv(e.OPENROUTER_MODEL) : '') || AGENT_MODELS[agent]
  return [...new Set([primary, OR_TEAM_FALLBACK])]
}

/* 1 panggilan OpenRouter — native fetch, kompatibel Cloudflare Workers.
   Coba model satu per satu sesuai chain; parsing standar OpenAI:
   result.choices?.[0]?.message?.content?.trim() */
async function openRouterChat(e: Env, chain: string[], systemPrompt: string, userPrompt: string, maxTokens = 1024, temperature?: number): Promise<{ text: string; model: string }> {
  const orKey = cleanEnv(e.OPENROUTER_API_KEY)
  if (!orKey) throw new Error('OPENROUTER_API_KEY belum diset — tambah di Cloudflare Workers Secrets')
  let lastErr = ''
  for (const model of chain) {
    try {
      const res = await fetch(OR_URL, {
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
          ...(temperature !== undefined ? { temperature } : {}),
        }),
        signal: timeoutSignal(45_000),
      })
      if (!res.ok) {
        lastErr = `${model} → HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`
        continue
      }
      const result: any = await res.json()
      const text = result?.choices?.[0]?.message?.content?.trim()
      if (!text) { lastErr = `${model} → respons kosong`; continue }
      return { text, model }
    } catch (x: any) {
      lastErr = `${model} → ${String(x?.message || x).slice(0, 120)}`
    }
  }
  throw new Error(lastErr || 'OpenRouter: semua model gagal')
}

/* Otak Multi-Agent: model resmi karyawan (OpenRouter) dulu →
   Gemini sebagai nyawa cadangan terakhir → kalau dua-duanya mati,
   caller wajib pakai templat statis (sistem tidak pernah crash). */
async function agentBrain(e: Env, agent: AgentKey, systemPrompt: string, userPrompt: string, maxTokens = 1024, temperature = 0.7): Promise<{ text: string; provider: 'openrouter' | 'gemini'; model: string }> {
  let err = ''
  try {
    const r = await openRouterChat(e, orChain(e, agent), systemPrompt, userPrompt, maxTokens, temperature)
    return { ...r, provider: 'openrouter' }
  } catch (x: any) { err = String(x?.message || x).slice(0, 140) }
  if (cleanEnv(e.GEMINI_API_KEY)) {
    try {
      const text = await geminiText(e, systemPrompt, userPrompt, maxTokens, temperature)
      return { text, provider: 'gemini', model: e.GEMINI_MODEL || 'gemini-2.5-flash' }
    } catch (x: any) { err += ' | Gemini: ' + String(x?.message || x).slice(0, 80) }
  }
  throw new Error(err || 'semua LLM gagal')
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

  /* SOP Bos: 1 draf TikTok / HARI. Draf hari ini yang sudah dibuat
     (dashboard dibuka / briefing pagi) dipakai ulang — hemat kuota model. */
  const dayKey = `cmo:${utcDay()}`
  try {
    const cached = await kvGet(e, dayKey)
    if (cached) return { ...JSON.parse(cached), dupToday: true }
  } catch { /* ignore */ }

  let history: string[] = []
  try { history = JSON.parse((await kvGet(e, 'drafts:history')) || '[]') } catch { /* ignore */ }

  /* Bahan analisis: konten asli TikTok Bos (diisi lewat Ruang CMO) */
  const posts = await fetchTopTikToks(e).catch(() => [])
  const tiktokBlock = posts.length
    ? `KONTEN TIKTOK ASLI milik CEO (urut views — paling atas TERBUKTI paling perform):\n` +
      posts.map((p, i) => `${i + 1}. [${fmtN(p.views)} views · ${fmtN(p.likes)} likes] "${(p.caption || '').slice(0, 400)}"`).join('\n')
    : ''

  /* SOP Sinta: draf hari ini juga WAJIB menjawab alasan churn dari rapat
     Maya × Sinta terakhir (bukan sekadar ikut angle rotasi). */
  let churnLine = ''
  try {
    const p = JSON.parse((await kvGet(e, 'cso-cmo:last')) || 'null')
    if (p?.diagnosis)
      churnLine =
        `\nHASIL RAPAT MAYA (CSO) TERAKHIR — akar masalah user males pakai jurnal:\n` +
        `"${String(p.diagnosis).slice(0, 200)}"` +
        (Array.isArray(p.reasons) && p.reasons.length ? `\nAlasan utama: ${p.reasons.slice(0, 3).join('; ')}` : '') +
        `\nSkrip hari ini WAJIB menjawab akar masalah tersebut.`
  } catch { /* ignore */ }

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
    churnLine +
    (history.length
      ? `\nNaskah yang SUDAH dipakai hari sebelumnya (DILARANG mengulang / mirip):\n` +
        history.map((h, i) => `— draf ${i + 1} —\n${h.slice(0, 500)}`).join('\n') + '\n'
      : '') +
    (posts.length ? `\nWAJIB: ambil pola dari konten berperform terbaik di atas — bukan naskah generik.\n` : '') +
    (await memBlock(e)) +
    `\nOutput: HANYA naskah TikTok baru (hook 3 detik pertama → body → CTA, durasi 30–45 detik), tanpa penjelasan tambahan.`

  /* ═══════ Rantai model SINTA (SOP Multi-Agent) ═══════
     1) OpenRouter zhipu/glm-4.7-flash (model resmi Sinta)
     2) OpenRouter zhipu/glm-4-flash (cadangan resmi — SOP Bos)
     3) Gemini (nyawa cadangan terakhir)
     4) fallbackDraft (fail-safe — teks statis, sistem tidak pernah crash) */
  let draft: string
  let provider: 'gemini' | 'openrouter' | 'fallback' = 'fallback'
  let model = ''
  let usedFallback = false
  let fallbackError = ''

  try {
    const brain = await agentBrain(e, 'cmo', systemPrompt, userPrompt, 2048, 1.0)
    draft = brain.text
    provider = brain.provider
    model = brain.model
  } catch (brainErr: any) {
    fallbackError = String(brainErr?.message || brainErr).slice(0, 160)
    draft = fallbackDraft(angle)
    usedFallback = true
  }

  history.unshift(draft)
  await kvSet(e, 'drafts:history', JSON.stringify(history.slice(0, 5)))
  await memAdd(e, 'CMO Sinta', `Draf TikTok (${angle}, ${model || provider}): ${draft.replace(/\s+/g, ' ').slice(0, 130)}`)
  const out = { draft, angle, usedFallback, provider, model, basedOn: posts.length ? 'tiktok' : 'reference', analyzedPosts: posts.length, ...(fallbackError ? { fallbackError } : {}) }
  await kvSet(e, dayKey, JSON.stringify(out)).catch(() => {})
  return out
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
function buildBriefing(cto: any, cso: any, cmo: any, cfo: any, autoAcc = '', autoOn = false, qa: any = null, cooLine = '', nbaLine = ''): string {
  const L: string[] = []
  L.push('🌅 **LAPORAN KERJA PAGI — LUXTRADE SUPER AI**')
  L.push(`📅 ${wibNow()} · 08:00 WIB — laporan harian semua karyawan`)
  L.push('━━━━━━━━━━━━━━━━━━')
  if (nbaLine) { L.push(nbaLine); L.push('━━━━━━━━━━━━━━━━━━') }
  L.push('🖥️ **CTO AGENT — IT & QA**')
  L.push(cto?.siteOk
    ? `• Website: ✅ ${cto.status} OK (${cto.latencyMs} ms)`
    : `• Website: ❌ DOWN (${cto?.status || 'timeout'})${cto?.err ? ' — ' + String(cto.err).slice(0, 80) : ''}`)
  L.push(cto?.bugs24h > 0 ? `• Bug 24 jam terakhir: ${cto.bugs24h} ⚠️ segera cek bug_reports`
    : cto?.bugs24h === 0 ? '• Bug 24 jam terakhir: 0 ✅'
    : `• Bug 24 jam: gagal diambil ⚠️ ${String(cto?.err || '').slice(0, 110)}`)
  if (qa && qa.total > 0) {
    L.push(qa.fails?.length
      ? `• QA ${qa.total} fitur dashboard: ${qa.ok} OK, ${qa.fails.length} MASALAH ⚠️`
      : `• QA otomatis ${qa.total} fitur dashboard: SEMUA OK ✅ (rata-rata ${qa.avgMs} ms)`)
    for (const f of (qa.fails || []).slice(0, 5))
      L.push(`   ↳ ${f.path} → ${f.status || 'timeout'}${f.err ? ' — ' + f.err : ''}`)
  }
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
  if (cmo?.usedFallback) L.push('_(semua model gagal — pakai draf cadangan, mohon revisi manual)_')
  else if (cmo?.provider === 'openrouter') L.push(`_(via OpenRouter — model resmi Sinta${cmo?.model ? ': ' + cmo.model : ''} ✅)_`)
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
  if (cooLine) L.push(cooLine)
  L.push('━━━━━━━━━━━━━━━━━━')
  if (autoAcc) L.push(autoAcc)
  L.push(autoOn
    ? '🤖 AUTO-ACC aktif — email sapaan user pasif dikirim CSO otomatis tiap pagi, Bos nggak perlu klik apa-apa.'
    : "Bos, klik tombol 'ACC EMAIL' di Ruang CEO (/kantor-ceo) jika ingin CSO mengirim email sapaan ke user pasif hari ini.")
  L.push('ℹ️ Alarm darurat (situs DOWN / bug baru / kuota 80%) dikirim INSTAN kapan pun — watchdog jaga tiap 15 menit.')
  return L.join('\n')
}

/* ALEXANDER (CEO) merangkai Morning Briefing — SOP Multi-Agent: model
   resminya (Llama 3.1 8B via OpenRouter) merapikan laporan mentah semua
   agen jadi satu briefing. Validasi ketat (wajib memuat seksi CTO/CSO/CMO,
   panjang masuk akal) — gagal → templat buildBriefing dipakai (fail-safe). */
async function ceoComposeBriefing(e: Env, templateText: string): Promise<{ text: string; model: string }> {
  const brain = await agentBrain(
    e, 'ceo',
    'Kamu Alexander, wakil CEO Luxtradee (jurnal trading XAUUSD). Tugas pagi ini: merangkai LAPORAN MENTAH dari karyawan AI jadi SATU Morning Briefing rapi untuk Discord Bos. ATURAN WAJIB: (1) pertahankan SEMUA angka & status penting (website, bug, user aktif/pasif, kuota, penawaran COO, email CSO); (2) format markdown Discord, mulai dengan baris "🌅 **LAPORAN KERJA PAGI — LUXTRADE SUPER AI**" lalu baris tanggal; (3) seksi dipisah ━━━━ dengan judul 🖥️ CTO / 👥 CSO / 📣 CMO / 💰 CFO; (4) maksimal 1800 karakter; (5) bahasa Indonesia, profesional tapi santai. Output HANYA isi briefing-nya, tanpa komentar pembuka/penutup.',
    `LAPORAN MENTAH KARYAWAN:\n${templateText}`,
    900, 0.4,
  )
  const text = brain.text.trim()
  if (text.length < 300 || ['CTO', 'CSO', 'CMO'].some((k) => !text.includes(k)))
    throw new Error('hasil Alexander tidak lolos validasi')
  return { text: text.slice(0, 1950), model: brain.model }
}

async function runMorningBriefing(e: Env) {
  const [cto, cso, cmo, cfo, qa, cooLine] = await Promise.all([
    ctoAgent(e).catch((x: any) => ({ siteOk: false, status: 0, latencyMs: 0, bugs24h: -1, err: String(x?.message || x) })),
    csoAgent(e).catch((x: any) => ({ total: -1, active: -1, passive: -1, err: String(x?.message || x) })),
    cmoAgent(e).catch((x: any) => ({ draft: '', angle: '', usedFallback: false, error: String(x?.message || x) })),
    cfoAgent(e).catch((x: any) => ({ limit: 0, usedToday: 0, usedYesterday: 0, quota429: 0, status: 'error', err: String(x?.message || x) })),
    qaAgent(e).catch((x: any) => ({ total: 0, ok: 0, fails: [], avgMs: 0, err: String(x?.message || x) })),
    cooYesterdayLine(e).catch(() => ''),
  ])
  /* AUTO-ACC — kalau owner menyalakannya, CSO kirim email pasif OTOMATIS
     (1×/hari, dedup via agent_kv acc_email:<tanggal>). Bos tidur, karyawan kerja. */
  const autoOn = (await kvGet(e, 'autoacc')) === 'on'
  let autoAcc = ''
  if (autoOn && !(await kvGet(e, `acc_email:${utcDay()}`))) {
    await kvSet(e, `acc_email:${utcDay()}`, new Date().toISOString())
    if (e.RESEND_API_KEY) {
      try { const r = await sendPassiveEmails(e); autoAcc = `📧 AUTO-ACC: ${r.sent} email PERSONAL terkirim ke user pasif (variasi "${r.variant}"; ${r.personalized} pakai data trading asli penerima; draf Maya via ${r.emailProvider === 'template' ? 'templat statis' : r.emailModel || r.emailProvider})` }
      catch (x: any) { autoAcc = `📧 AUTO-ACC gagal kirim: ${String(x?.message || x).slice(0, 80)}` }
    } else autoAcc = '📧 AUTO-ACC aktif tapi RESEND_API_KEY belum diset — email belum terkirim'
    try { if (autoAcc) await sendDiscord(e, autoAcc) } catch { /* ignore */ }
  }
  /* AKUNTABILITAS NBA — Alexander ingatkan prioritas KEMARIN dulu.
     Bos jadi punya jejak: dilakukan atau harus ada alasan ganti. */
  let nbaLine = ''
  try {
    const raw = await kvGet(e, 'nba:last')
    if (raw) {
      const p = JSON.parse(raw) as { at?: string; text?: string }
      if (p?.text && String(p.at || '').slice(0, 10) && String(p.at).slice(0, 10) < utcDay())
        nbaLine = `🎯 **PRIORITAS KEMARIN**: ${p.text}\n→ Bos, dilakukan? Kalau belum: jadikan prioritas utama hari ini, atau bilang Alexander kenapa diganti.`
    }
  } catch { /* ignore */ }

  /* ALEXANDER (CEO) yang merangkai — kalau modelnya gagal, templat
     buildBriefing tetap dipakai (sistem tidak pernah tanpa laporan). */
  const templateText = buildBriefing(cto, cso, cmo, cfo, autoAcc, autoOn, qa, cooLine, nbaLine)
  let text = templateText
  try {
    const composed = await ceoComposeBriefing(e, templateText)
    text = `${composed.text}\n_(dirapikan Alexander — CEO AI · ${composed.model})_`
    await memAdd(e, 'CEO Alexander', `Morning Briefing disusun via ${composed.model}`)
  } catch { /* templat tetap dipakai */ }
  let notifySent = false, notifyErr = ''
  try { await sendDiscord(e, text); notifySent = true } catch (x: any) { notifyErr = String(x?.message || x) }

  /* DISKUSI HARIAN CSO × CMO — 1×/hari, otomatis setelah briefing utama.
     Maya laporkan akar masalah user pasif + Sinta bikin skrip konten.
     Hasilnya dikirim ke Discord SEBAGAI PESAN TERPISAH (briefing utama
     sudah hampir penuh 2000 char) + disimpan buat panel Ruang CSO.
     Kalau Bos sudah jalankan manual hari ini → skip (no duplikat). */
  let talk: CsoCmoTalk | null = null
  let talkSent = false
  try {
    if (!(await kvGet(e, `cso-cmo:${utcDay()}`))) {
      await kvSet(e, `cso-cmo:${utcDay()}`, new Date().toISOString())
      talk = await csoCmoTalk(e)
      try { await sendDiscord(e, talkToDiscord(talk)); talkSent = true } catch { /* ignore */ }
    } else {
      const raw = await kvGet(e, 'cso-cmo:last')
      if (raw) talk = JSON.parse(raw) as CsoCmoTalk
    }
  } catch { /* talk opsional — briefing utama tetap sah */ }

  /* NEXT BEST ACTION — Alexander pilih 1 prioritas Bos hari ini
     (pesan Discord terpisah + tampil di Ruang Rapat). Dedup harian. */
  let nba: { at: string; text: string } | null = null
  try {
    if (!(await kvGet(e, `nba:${utcDay()}`))) {
      await kvSet(e, `nba:${utcDay()}`, new Date().toISOString())
      const t = await nextBestAction(e, text)
      if (t) nba = { at: new Date().toISOString(), text: t }
    } else {
      const raw = await kvGet(e, 'nba:last')
      if (raw) nba = JSON.parse(raw) as { at: string; text: string }
    }
  } catch { /* opsional */ }

  const summary = { at: new Date().toISOString(), notifySent, notifyErr, cto, cso, cmo, cfo, talk, talkSent, nba, text }
  await kvSet(e, 'briefing:last', JSON.stringify(summary))
  return summary
}

/* ---------- flow "ACC EMAIL": email ke user pasif ----------
   v3: EMAIL PERSONAL per user — Maya baca data trading ASLI tiap
   penerima (jumlah trade, pair favorit, berapa hari lalu terakhir
   upload, onboarding) → tiap user dapat email yang relevan dengan
   DIRINYA, bukan template generik. Variasi pesan tetap dirotasi
   harian (anti email fatigue) + ID penerima dicatat → besok dihitung
   berapa yang BALIK upload (feedback loop nyata). */

const PASSIVE_VARIANTS = [
  {
    subject: 'Lama gak ketemu 👋',
    text: 'Yuk evaluasi visual hari ini di https://luxtradee.web.id — cuma 2 menit.\n\n— Tim Luxtrade',
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

/* Footer statis — SELALU ditambahkan sistem (bukan LLM) supaya link &
   tanda tangan tidak pernah hilang/halusinasi. */
const CSO_EMAIL_FOOTER = 'Upload screenshot terakhir lo — evaluasi AI jalan dalam 2 menit: https://luxtradee.web.id\n\n— Tim Luxtrade'
/* Rotasi 3 variasi nada email Maya (SOP: rotasi 3 variasi) */
const CSO_EMAIL_TONES = [
  'sapaan hangat yang kangen — seperti teman lama yang peduli',
  'motivasi disiplin — trader hebat adalah yang balik lagi setelah vakum',
  'nostalgia — ingatkan betapa cepat waktu berlalu & jurnalnya masih menunggu',
]

interface PerUserTrade { n: number; top: string; lastAt: number; wins: number }

async function buildPerUserTradeMap(e: Env): Promise<Map<string, PerUserTrade>> {
  const map = new Map<string, PerUserTrade>()
  try {
    const rows = await fetchTrades30(e)
    for (const r of rows) {
      if (!r.user_id) continue
      const cur = map.get(r.user_id) || { n: 0, top: '', lastAt: 0, wins: 0 }
      cur.n++
      if ((r.profit_loss || 0) > 0) cur.wins++
      if (r.symbol) (cur as any)._sym = { ...((cur as any)._sym || {}), [r.symbol]: (((cur as any)._sym || {})[r.symbol] || 0) + 1 }
      if (r.created_at) cur.lastAt = Math.max(cur.lastAt, new Date(r.created_at).getTime())
      map.set(r.user_id, cur)
    }
    /* pair favorit per user */
    for (const [, v] of map) {
      const syms = (v as any)._sym as Record<string, number> | undefined
      if (syms) v.top = Object.entries(syms).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
      delete (v as any)._sym
    }
  } catch { /* tanpa data trade → email tetap terkirim (mode generik) */ }
  return map
}

function personalLine(name: string, t: PerUserTrade | undefined, createdAgeDays: number): string {
  const hai = name ? `Hai ${name}!` : 'Hai!'
  if (t && t.n > 0) {
    const days = Math.max(1, Math.round((Date.now() - t.lastAt) / 86400_000))
    const wr = Math.round((t.wins / t.n) * 100)
    return `${hai} Kamu sudah nyatet ${t.n} trade di Luxtrade${t.top ? ` — ${t.top} jadi pair andalanmu` : ''} (win rate catatanmu ${wr}%). Terakhir upload ${days} hari lalu — momen bagus gak boleh putus di sini.`
  }
  if (createdAgeDays >= 3)
    return `${hai} Akunmu sudah ${createdAgeDays} hari bergabung, tapi belum ada 1 screenshot pun yang diupload — padahal evaluasi AI-nya cuma butuh 2 menit per trade.`
  return hai
}

async function sendPassiveEmails(e: Env): Promise<{ sent: number; ids: string[]; variant: string; personalized: number; emailProvider: string; emailModel: string }> {
  const since = isoAgo(24)
  const activeIds = await fetchActiveUserIds(e, since)

  // kandidat: profil dengan email, terbaru dulu — maks 200 kandidat
  /* Pakai service_role key — profiles butuh bypass RLS */
  const url = `${sbUrl(e)}/rest/v1/profiles?select=id,email,full_name,created_at&email=not.is.null&order=created_at.desc&limit=200`
  const res = await fetch(url, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) throw new Error(`Supabase profiles HTTP ${res.status}${res.status === 401 && !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) ? ' — set SUPABASE_SERVICE_ROLE_KEY' : ''}`)
  const profiles = (await res.json()) as { id?: string; email?: string; full_name?: string | null; created_at?: string }[]

  const targets = profiles
    .filter((p) => p.email && p.id && !activeIds.has(p.id))
    .slice(0, 50)

  /* SOP Multi-Agent — MAYA (CSO) meracik draf email hari ini pakai model
     resminya (google/gemma-2-9b-it:free via OpenRouter), rotasi 3 variasi
     nada, maks 50 user pasif. 1 panggilan LLM/hari; sapaan personal per
     user tetap dari data trading ASLI (personalLine) + CTA statis sistem.
     Gagal → templat statis PASSIVE_VARIANTS (fail-safe). */
  const variantIdx = dayIndex() % PASSIVE_VARIANTS.length
  let variant = PASSIVE_VARIANTS[variantIdx]
  let emailProvider = 'template'
  let emailModel = ''
  try {
    const brain = await agentBrain(
      e, 'cso',
      'Kamu Maya, CSO Luxtradee — web app jurnal trading XAUUSD (upload screenshot → evaluasi AI). Tulis 1 email sapaan hangat untuk user pasif (tidak upload jurnal >24 jam). Gaya: bahasa Indonesia santai & hangat, maksimal 80 kata, TANPA link/URL apa pun (sistem menambahkan link & tanda tangan otomatis), TANPA markdown, TANPA sapaan nama (sistem menambahkan sapaan personal per penerima). ' +
      `Nada variasi hari ini: ${CSO_EMAIL_TONES[variantIdx]}. ` +
      'OUTPUT HANYA JSON valid: {"subject":"maks 60 karakter, boleh 1 emoji","body":"isi email tanpa sapaan nama"}',
      `Konteks: ${targets.length} user pasif akan dikontak hari ini. Tanggal: ${wibNow()}.`,
      400, 0.8,
    )
    const parsed = JSON.parse(extractJsonLoose(brain.text) || '{}') as { subject?: string; body?: string }
    const subject = String(parsed.subject || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 120)
    const body = String(parsed.body || '').replace(/https?:\/\/\S+/g, '').replace(/```/g, '').trim().slice(0, 700)
    if (subject && body && body.length > 40) {
      variant = { subject, text: `${body}\n\n${CSO_EMAIL_FOOTER}` }
      emailProvider = brain.provider
      emailModel = brain.model
    }
  } catch { /* templat statis tetap dipakai */ }

  /* Data trading personal per penerima — 1 kueri untuk semua */
  const tradeMap = await buildPerUserTradeMap(e)

  let sent = 0, personalized = 0
  const emailedIds: string[] = []
  for (const p of targets) {
    const t = tradeMap.get(p.id as string)
    const createdAgeDays = p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400_000) : 0
    const name = (p.full_name || '').trim().split(/\s+/)[0] || ''
    const line = personalLine(name, t, createdAgeDays)
    if (t || createdAgeDays >= 3) personalized++
    const body = `${line}\n\n${variant.text}`
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: p.email as string,
        subject: variant.subject,
        text: body,
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
  if (sent) await memAdd(e, 'CSO Maya', `${sent} email personal ke user pasif (variasi "${variant.subject}"; ${personalized} pakai data trade asli penerima; draf via ${emailProvider === 'template' ? 'templat statis' : emailModel})`)
  return { sent, ids: emailedIds, variant: variant.subject, personalized, emailProvider, emailModel }
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
      /* TRIAGE otomatis (RAKA — CTO): 3 bug terakhir diringkas jadi diagnosa
         + prioritas P1-P3 oleh model resmi Raka (qwen-2.5-coder-7b via
         OpenRouter) → Bos nggak perlu buka Supabase manual.
         LLM hanya dipanggil SAAT bug baru masuk (bukan tiap 15 mnt). */
      let triage = ''
      try {
        const bres = await fetch(`${sbUrl(e)}/rest/v1/bug_reports?select=description&order=created_at.desc&limit=3`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
        const bugs: { description?: string }[] = bres.ok ? await bres.json() : []
        const list = bugs.map((b, i) => `${i + 1}. ${String(b.description || '').replace(/\s+/g, ' ').slice(0, 300)}`).filter((s) => s.length > 3).join('\n')
        if (list) {
          try {
            const brain = await agentBrain(
              e, 'cto',
              'Kamu Raka, CTO Luxtradee (web app jurnal trading). Ringkas laporan bug user jadi diagnosa singkat & actionable. Format per baris: "- [P1/P2/P3] masalah → kemungkinan penyebab/lokasi". P1=kritis (situs/fitur utama mati), P2=gangguan, P3=minor. Satu baris per bug, tanpa pembuka/penutup.',
              `Laporan bug terbaru:\n${list}`,
              512, 0.3,
            )
            triage = brain.text
          } catch { triage = list } // semua model gagal → alarm tetap kirim dgn daftar mentah
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
   QA OTOMATIS (CTO) — tes semua fitur/route utama Luxtradee
   Dipanggil: briefing 08:00 WIB + tombol manual Ruang CTO.
   Status tak terduga (5xx/timeout) = MASALAH → dilaporkan.
   CF 521-524 (self-ping false negative) dianggap OK — sama
   seperti ctoAgent: Worker ini jalan = situs pasti hidup.
   ============================================================ */
const QA_ROUTES: { path: string; label: string; expect: number[] }[] = [
  { path: '/', label: 'Landing page', expect: [200] },
  { path: '/about', label: 'Tentang', expect: [200] },
  { path: '/blog', label: 'Blog', expect: [200] },
  { path: '/faq', label: 'FAQ', expect: [200] },
  { path: '/contact', label: 'Kontak', expect: [200] },
  { path: '/upgrade', label: 'Upgrade PRO', expect: [200] },
  { path: '/affiliate', label: 'Affiliate', expect: [200] },
  { path: '/dashboard', label: 'Dashboard user', expect: [200] },
  { path: '/settings', label: 'Pengaturan', expect: [200] },
  { path: '/kantor-ceo', label: 'Kantor CEO', expect: [200] },
  { path: '/api/health', label: 'API health', expect: [200] },
  { path: '/api/landing-stats', label: 'API landing stats', expect: [200] },
]

async function qaAgent(e: Env) {
  const CF_FALSE = [521, 522, 523, 524]
  const results = await Promise.all(QA_ROUTES.map(async (r) => {
    const t0 = Date.now()
    try {
      const res = await fetch(SITE_URL + r.path, { redirect: 'follow', signal: timeoutSignal(12_000) })
      const cfFalse = CF_FALSE.includes(res.status)
      return { path: r.path, label: r.label, status: cfFalse ? 200 : res.status, ok: r.expect.includes(res.status) || cfFalse, ms: Date.now() - t0 }
    } catch (x: any) {
      return { path: r.path, label: r.label, status: 0, ok: false, ms: Date.now() - t0, err: String(x?.message || x).slice(0, 60) }
    }
  }))
  const fails = results.filter((r) => !r.ok)
  const avgMs = Math.round(results.reduce((a, r) => a + r.ms, 0) / (results.length || 1))
  const out = { at: new Date().toISOString(), total: results.length, ok: results.length - fails.length, fails, avgMs, results }
  await kvSet(e, 'qa:last', JSON.stringify(out)).catch(() => {})
  return out
}

/* Antrean COO — hitung draf penawaran yang masih menunggu ACC Bos.
   Dipakai: kartu overview, status live karakter 3D, panel Ruang COO.
   Tabel ai_pending_tasks dibuat lewat supabase-migrations/013 —
   kalau tabelnya belum ada, balik kosong (jangan error). */
async function cooPending(e: Env): Promise<{ pending: number; approved24h: number }> {
  const out = { pending: 0, approved24h: 0 }
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) return out
  const res = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_tasks?agent_type=eq.COO&created_at=gte.${encodeURIComponent(isoAgo(48))}&select=status`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) return out
  const rows = (await res.json()) as { status?: string }[]
  out.pending = rows.filter((r) => r.status === 'pending').length
  out.approved24h = rows.filter((r) => r.status === 'approved').length
  return out
}

/* Ringkasan kerja COO 24 jam terakhir — buat laporan pagi 08:00 */
async function cooYesterdayLine(e: Env): Promise<string> {
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) return ''
  const res = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_tasks?agent_type=eq.COO&created_at=gte.${encodeURIComponent(isoAgo(24))}&select=status`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) return ''
  const rows = (await res.json()) as { status?: string }[]
  if (!rows.length) return ''
  const pending = rows.filter((r) => r.status === 'pending').length
  const approved = rows.filter((r) => r.status === 'approved').length
  return `💼 **COO — Divisi Jualan**: ${rows.length} draf penawaran 24 jam terakhir (${approved} terkirim, ${pending} menunggu ACC Bos di Ruang COO — /kantor-ceo)`
}

/* ============================================================
   DISKUSI HARIAN CSO × CMO (RuCSO upgrade)
   Maya (CSO) bawa DATA NYATA user pasif ke meja Sinta (CMO):
   berapa yang mendaftar tapi tak pernah upload jurnal, keluhan
   bug, feedback email. Gemini menyusun DIALOG keduanya mencari
   ROOT CAUSE "kenapa user nggak mau pakai jurnal" → lalu CMO
   menulis 1 SKRIP KONTEN TikTok yang menjawab alasan teratas.
   Dipakai: tombol manual Ruang CSO + otomatis 1×/hari di briefing 08:00.
   ============================================================ */
interface TalkTurn { who: 'CSO' | 'CMO'; text: string }
interface CsoCmoTalk {
  at: string
  provider: 'gemini' | 'openrouter' | 'fallback'
  diagnosis: string
  reasons: string[]
  dialog: TalkTurn[]
  script: { hook: string; body: string; cta: string }
  intel: { total: number; active24h: number; active7d: number; passive: number; baruTakAktif: number; bug7d: number }
  raw?: string
}

/* JSON tololeran: buang fence markdown, ambil blok { ... } terluas */
function extractJsonLoose(text: string): string | null {
  const clean = text.replace(/```(?:json)?/gi, '').trim()
  const a = clean.indexOf('{')
  const b = clean.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  return clean.slice(a, b + 1)
}

async function csoCmoTalk(e: Env): Promise<CsoCmoTalk> {
  /* ---- 1. Kumpulkan intel nyata dari database ---- */
  const active24 = await fetchActiveUserIds(e, isoAgo(24))
  const active7 = await fetchActiveUserIds(e, isoAgo(24 * 7))
  const total = await supaCount(e, 'profiles')
  const baru14 = await supaCount(e, 'profiles', 'created_at=gte.' + isoAgo(24 * 14))
  const bug7d = await supaCount(e, 'bug_reports', 'created_at=gte.' + isoAgo(24 * 7)).catch(() => -1)

  /* Contoh keluhan user (bug 7 hari) — bahan obrolan konkret */
  let bugSamples: string[] = []
  try {
    const bres = await fetch(`${sbUrl(e)}/rest/v1/bug_reports?select=description&created_at=gte.${encodeURIComponent(isoAgo(24 * 7))}&order=created_at.desc&limit=5`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    if (bres.ok) bugSamples = ((await bres.json()) as { description?: string }[]).map((b) => String(b.description || '').replace(/\s+/g, ' ').slice(0, 160)).filter((s) => s.length > 3)
  } catch { /* opsional */ }

  /* Feedback email CSO kemarin — berapa yang balik */
  let emailed = 0, returned = 0
  try {
    const ids: string[] = JSON.parse((await kvGet(e, `csmailed:${utcDay(-1)}`)) || '[]')
    emailed = ids.length
    returned = ids.filter((id) => active7.has(id)).length
  } catch { /* ignore */ }

  const intel = {
    total,
    active24h: active24.size,
    active7d: active7.size,
    passive: Math.max(0, total - active24.size),
    /* Pendaftar 14 hari terakhir yang TIDAK pernah upload jurnal = calon churn paling nyata */
    baruTakAktif: Math.max(0, baru14 - active7.size),
    bug7d,
  }

  const intelText =
    `DATA NYATA Luxtradee (web app jurnal trading XAUUSD, upload screenshot → evaluasi AI):\n` +
    `- Total pendaftar: ${intel.total}\n` +
    `- Aktif 24 jam: ${intel.active24h} · Aktif 7 hari: ${intel.active7d}\n` +
    `- Pasif (di luar 24 jam): ${intel.passive}\n` +
    `- Daftar 14 hari terakhir: ${baru14} — ${intel.baruTakAktif} di antaranya BELUM PERNAH upload jurnal sama sekali\n` +
    (emailed ? `- Email sapaan kemarin: ${emailed} user dikontak, ${returned} balik aktif\n` : '') +
    (bug7d >= 0 ? `- Laporan bug 7 hari: ${bug7d}\n` : '') +
    (bugSamples.length ? `- Contoh keluhan user:\n${bugSamples.map((s) => `  • ${s}`).join('\n')}\n` : '')

  /* ---- 2. Dialog Maya (CSO) × Sinta (CMO) + skrip konten ---- */
  const systemPrompt =
    `Kamu penulis skenario internal tim Luxtradee. Tulis DIALOG kerja singkat antara 2 karyawan AI:\n` +
    `- MAYA (CSO, cewek, peduli user, bicara pake data)\n` +
    `- SINTA (CMO, copywriter TikTok, bahasa gaul kreatif)\n\n` +
    `TOPIK: cari akar masalah KENAPA user mendaftar tapi nggak mau/males pakai jurnal trading (upload screenshot). Maya bawa data, Sinta menduga-duga penyebab psikologis (malas, bingung mulai, ngerasa ribet, belum yakin manfaat) dan mengusulkan angle konten.\n` +
    `Akhi: Sinta membuat 1 skrip video TikTok (hook 3 detik → isi → CTA, 30-45 dtk) yang MENJAWAB alasan teratas — target trader XAUUSD Indonesia.\n` +
    `Kalau ada hasil diskusi sebelumnya di bawah: JANGAN mengulang kesimpulan yang sama persis — verifikasi dengan data terbaru, gali akar yang belum dibahas, atau nyatakan pola baru.\n\n` +
    `OUTPUT HANYA JSON valid (tanpa markdown, tanpa penjelasan):\n` +
    `{"diagnosis":"1-2 kalimat inti masalah","reasons":["alasan 1","alasan 2","alasan 3"],"dialog":[{"who":"CSO","text":"..."},{"who":"CMO","text":"..."}],"script":{"hook":"...","body":"...","cta":"..."}}\n` +
    `Aturan: dialog 6-8 giliran pergantian, tiap teks maks 200 karakter, bahasa Indonesia santai, sebutkan angka data yang nyata.`

  /* Learning loop: baca kesimpulan diskusi sebelumnya → Maya & Sinta
     tidak mengulang verbatim — mereka verifikasi/memperdalam. */
  let prevTalk = ''
  try {
    const p = JSON.parse((await kvGet(e, 'cso-cmo:last')) || 'null')
    if (p?.diagnosis)
      prevTalk = `\nHASIL DISKUSI KALIAN SEBELUMNYA (${String(p.at || '').slice(0, 10)}): diagnosis "${String(p.diagnosis).slice(0, 200)}"${Array.isArray(p.reasons) && p.reasons.length ? ' — alasan: ' + p.reasons.slice(0, 3).join('; ') : ''}`
  } catch { /* ignore */ }

  const userPrompt = `${intelText}${prevTalk}${await memBlock(e)}\nTanggal: ${wibNow()}. Buat dialog + skrip sekarang.`

  let provider: CsoCmoTalk['provider'] = 'fallback'
  let parsed: Omit<CsoCmoTalk, 'at' | 'provider' | 'intel' | 'raw'> | null = null
  let raw = ''
  try {
    /* SOP Multi-Agent — rapat dibawakan MAYA (CSO) dengan modelnya sendiri
       (gemma-2-9b via OpenRouter) → Gemini nyawa cadangan → templat. */
    const brain = await agentBrain(e, 'cso', systemPrompt, userPrompt, 2048, 0.8)
    raw = brain.text
    provider = brain.provider
  } catch { raw = '' }

  if (raw) {
    try {
      const j = JSON.parse(extractJsonLoose(raw) || raw)
      const dialog: TalkTurn[] = Array.isArray(j.dialog)
        ? j.dialog
            .map((d: { who?: string; text?: string }) => ({ who: String(d?.who || '').toUpperCase().includes('CMO') ? 'CMO' : 'CSO', text: String(d?.text || '').slice(0, 400) }))
            .filter((d: TalkTurn) => d.text)
        : []
      if (dialog.length >= 2 && (j.script?.hook || j.diagnosis)) {
        parsed = {
          diagnosis: String(j.diagnosis || '').slice(0, 400),
          reasons: Array.isArray(j.reasons) ? j.reasons.map((r: unknown) => String(r).slice(0, 140)).slice(0, 5) : [],
          dialog,
          script: {
            hook: String(j.script?.hook || '').slice(0, 400),
            body: String(j.script?.body || '').slice(0, 900),
            cta: String(j.script?.cta || '').slice(0, 300),
          },
        }
      }
    } catch { /* JSON rusak → fallback */ }
  }

  if (!parsed) {
    /* Fallback tanpa LLM: dialog templat dari data nyata */
    provider = 'fallback'
    const topReason = intel.baruTakAktif > 0
      ? `${intel.baruTakAktif} dari ${baru14} pendaftar baru belum pernah upload jurnal`
      : `${intel.passive} user pasif tidak upload dalam 24 jam`
    parsed = {
      diagnosis: `${topReason} — kemungkinan karena terasa ribet/bingung mulai, bukan karena tidak tertarik.`,
      reasons: [
        'Bingung mulai — nggak tahu screenshot yang bagus seperti apa',
        'Kira jurnal = ngetik manual yang panjang',
        'Belum merasakan manfaat evaluasi di 5 menit pertama',
      ],
      dialog: [
        { who: 'CSO', text: `Sinta, dari data: ${topReason}. Ini pola yang sama tiap minggu.` },
        { who: 'CMO', text: 'Berarti masalahnya bukan "males nggak mau" — tapi mereka belum lihat prosesnya semudah apa. Kita tunjukkan, jangkan dijelasin.' },
        { who: 'CSO', text: 'Setuju. Keluhan terbanyak juga soal mulai yang bingung, bukan soal fitur.' },
        { who: 'CMO', text: 'Oke, gua bikin skrip: video 30 detik, tunjukkan upload screenshot → evaluasi muncul. Satu take, no talking-head.' },
      ],
      script: {
        hook: '"Daftar tapi belum pernah upload jurnal? Rugi 90% manfaatnya."',
        body: `Rekam layar: drag screenshot trade → upload → evaluasi AI muncul dalam hitungan detik. Teks besar: "Bukan ngetik. Cuma 2 menit." Tutup dengan chart perbandingan before/after pakai evaluasi. Data bagimu: ${intel.baruTakAktif || intel.passive} trader lain masih nunda — jadi yang beda.`,
        cta: '"Upload 1 screenshot hari ini — link di bio, gratis."',
      },
    }
  }

  const out: CsoCmoTalk = { at: new Date().toISOString(), provider, intel, ...parsed }
  await kvSet(e, 'cso-cmo:last', JSON.stringify(out)).catch(() => {})
  if (out.diagnosis) await memAdd(e, 'Maya × Sinta', `Rapat CSO×CMO — ${String(out.diagnosis).slice(0, 150)}${out.script?.hook ? ' → skrip: "' + String(out.script.hook).slice(0, 60) + '"' : ''}`)
  return out
}

/* Versi teks buat Discord — pesan terpisah setelah briefing utama */
function talkToDiscord(t: CsoCmoTalk): string {
  const L: string[] = []
  L.push('💬 **DISKUSI CSO × CMO — kenapa user males upload jurnal?**')
  L.push(`🔍 ${t.diagnosis}`)
  for (const d of t.dialog.slice(0, 6)) L.push(`${d.who === 'CSO' ? '👩‍💼 Maya (CSO)' : '📣 Sinta (CMO)'}: ${d.text}`)
  if (t.script?.hook) {
    L.push('')
    L.push('🎬 **SKRIP KONTEN HASIL RAPAT:**')
    L.push(`HOOK: ${t.script.hook}\nISI: ${t.script.body}\nCTA: ${t.script.cta}`)
  }
  L.push('_(Diskusi otomatis CSO × CMO — skrip lengkap ada di Ruang CSO /kantor-ceo)_')
  return L.join('\n').slice(0, 1900)
}

/* ============================================================
   AGEN 6 — DEWI (DATA ANALYST): pola trading user dari trades
   Kueri NYATA 30 hari (maks 1000 trade terbaru): win rate,
   pair favorit, sesi & jam tersibuk → Gemini jadikan insight +
   3 rekomendasi. Learning loop: insight minggu lalu ikut dibaca
   → Dewi evaluasi rekomendasinya sendiri, bukan analisis amnesia.
   ============================================================ */
interface DaInsight {
  at: string
  provider: 'gemini' | 'openrouter' | 'fallback'
  insight: string
  patterns: string[]
  recommendations: string[]
  stats: { uploads30: number; uploads7: number; traders30: number; winRate: number; topSymbol: string; topSession: string; bestHour: string }
  dupToday?: boolean
}

async function fetchTrades30(e: Env) {
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/trades?select=symbol,profit_loss,session,user_id,created_at&created_at=gte.${encodeURIComponent(isoAgo(24 * 30))}&order=created_at.desc&limit=1000`,
    { headers: sbHPriv(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) throw new Error(`Supabase trades HTTP ${res.status}${res.status === 401 && !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) ? ' — set SUPABASE_SERVICE_ROLE_KEY' : ''}`)
  return (await res.json()) as { symbol?: string; profit_loss?: number; session?: string | null; user_id?: string; created_at?: string }[]
}

function computeTradeStats(rows: { symbol?: string; profit_loss?: number; session?: string | null; user_id?: string; created_at?: string }[]) {
  const traders = new Set<string>()
  const sym: Record<string, number> = {}
  const ses: Record<string, number> = {}
  const hour: Record<number, number> = {}
  let wins = 0, up7 = 0
  const since7 = Date.now() - 24 * 7 * 3600_000
  for (const r of rows) {
    if (r.user_id) traders.add(r.user_id)
    if (r.symbol) sym[r.symbol] = (sym[r.symbol] || 0) + 1
    if (r.session) ses[r.session] = (ses[r.session] || 0) + 1
    if (r.created_at) {
      if (new Date(r.created_at).getTime() >= since7) up7++
      const h = (new Date(r.created_at).getUTCHours() + 7) % 24 // konversi ke WIB
      hour[h] = (hour[h] || 0) + 1
    }
    if ((r.profit_loss || 0) > 0) wins++
  }
  const top = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
  const bh = Object.entries(hour).sort((a, b) => b[1] - a[1])[0]?.[0]
  return {
    uploads30: rows.length,
    uploads7: up7,
    traders30: traders.size,
    winRate: rows.length ? Math.round((wins / rows.length) * 100) : 0,
    topSymbol: top(sym),
    topSession: top(ses),
    bestHour: bh !== undefined ? `${bh}:00 WIB` : '—',
  }
}

async function analystAgent(e: Env): Promise<DaInsight> {
  const rows = await fetchTrades30(e)
  const stats = computeTradeStats(rows)
  const base = { at: new Date().toISOString(), stats }

  if (!rows.length) {
    const out: DaInsight = { ...base, provider: 'fallback',
      insight: 'Belum ada trade dalam 30 hari terakhir — insight otomatis muncul begitu user mulai upload jurnal.',
      patterns: [], recommendations: ['Fokus aktivasi user baru dulu (cek Ruang Growth) — tanpa data trade, analisis tidak bisa jalan'] }
    await kvSet(e, 'da:last', JSON.stringify(out)).catch(() => {})
    return out
  }

  /* Learning loop: baca insight sendiri sebelumnya → evaluasi, jangan mengulang */
  let prev = ''
  try {
    const p = JSON.parse((await kvGet(e, 'da:last')) || 'null')
    if (p?.insight)
      prev = `\nINSIGHT KAMU SEBELUMNYA (${String(p.at || '').slice(0, 10)}): "${String(p.insight).slice(0, 220)}"${Array.isArray(p.recommendations) && p.recommendations.length ? '\nRekomendasi kemarin: ' + p.recommendations.slice(0, 3).join(' | ').slice(0, 220) : ''}\nCek angka di atas: apakah rekomendasi kemarin mulai terlihat efeknya? Jangan ulangi verbatim — perdalam atau ganti fokus.`
  } catch { /* ignore */ }

  const dataText =
    `DATA TRADES 30 HARI TERAKHIR (nyata, dari database Luxtradee):\n` +
    `- Total upload jurnal: ${stats.uploads30} (${stats.uploads7} dalam 7 hari terakhir)\n` +
    `- Trader aktif unik: ${stats.traders30} (rata-rata ${stats.traders30 ? (stats.uploads30 / stats.traders30).toFixed(1) : 0} trade/trader)\n` +
    `- Win rate agregat: ${stats.winRate}%\n` +
    `- Pair paling sering: ${stats.topSymbol} · Sesi tersibuk: ${stats.topSession} · Jam paling ramai: ${stats.bestHour}`

  const systemPrompt =
    `Kamu Dewi, Data Analyst Luxtradee (web app jurnal trading XAUUSD — user upload screenshot/record trade, AI evaluasi visual). ` +
    `Analisis angka nyata, temukan pola yang tidak terlihat kasat mata, kasih rekomendasi konkret yang bisa dieksekusi Bos minggu ini (produk, konten, atau retensi). ` +
    `OUTPUT HANYA JSON valid (tanpa markdown): {"insight":"maks 2 kalimat","patterns":["pola 1","pola 2","pola 3"],"recommendations":["rekomendasi 1","rekomendasi 2","rekomendasi 3"]} — bahasa Indonesia santai-profesional, sebut angka nyata.`

  let provider: DaInsight['provider'] = 'fallback'
  let insight = '', patterns: string[] = [], recommendations: string[] = []
  let raw = ''
  try {
    /* SOP Multi-Agent — DEWI (DA) analisis pakai modelnya sendiri → Gemini cadangan */
    const brain = await agentBrain(e, 'da', systemPrompt, dataText + prev + (await memBlock(e)) + `\nTanggal: ${wibNow()}`, 1024, 0.5)
    raw = brain.text
    provider = brain.provider
  } catch { raw = '' }
  if (raw) {
    try {
      const j2 = JSON.parse(extractJsonLoose(raw) || raw)
      insight = String(j2.insight || '').slice(0, 400)
      patterns = Array.isArray(j2.patterns) ? j2.patterns.map((x: unknown) => String(x).slice(0, 180)).slice(0, 4) : []
      recommendations = Array.isArray(j2.recommendations) ? j2.recommendations.map((x: unknown) => String(x).slice(0, 180)).slice(0, 4) : []
    } catch { raw = '' }
  }
  if (!insight) {
    /* Fallback TANPA LLM — tetap dari angka nyata */
    provider = 'fallback'
    insight = `${stats.uploads30} upload dari ${stats.traders30} trader dalam 30 hari — win rate agregat ${stats.winRate}%. Pair favorit ${stats.topSymbol}, sesi tersibuk ${stats.topSession} (puncak ${stats.bestHour}).`
    patterns = [
      `Pair teraktif: ${stats.topSymbol}`,
      `Sesi tersibuk: ${stats.topSession}, puncak jam ${stats.bestHour}`,
      `Rata-rata ${stats.traders30 ? (stats.uploads30 / stats.traders30).toFixed(1) : 0} trade per trader · 7 hari terakhir ${stats.uploads7} upload`,
    ]
    recommendations = [
      stats.winRate < 45 ? 'Win rate di bawah 45% — konten edukasi "evaluasi sebelum entry" sangat relevan buat mayoritas user' : 'Win rate sehat — dorong user membagikan hasilnya ke komunitas (social proof)',
      `Jadwalkan posting TikTok menjelang ${stats.bestHour} — itulah jam trader paling aktif online`,
      `Sorot pair ${stats.topSymbol} & sesi ${stats.topSession} di konten CMO biar relevan dengan mayoritas user`,
    ]
  }

  const out: DaInsight = { ...base, provider, insight, patterns, recommendations }
  await kvSet(e, 'da:last', JSON.stringify(out)).catch(() => {})
  if (insight) await memAdd(e, 'DA Dewi', `Analisis 30 hari (${stats.traders30} trader, WR ${stats.winRate}%, favorit ${stats.topSymbol}): ${insight}`)
  return out
}

function daToDiscord(d: DaInsight): string {
  const L = ['📊 **DATA ANALYST — INSIGHT MINGGUAN (Dewi)**', `🔍 ${d.insight}`]
  if (d.patterns?.length) { L.push('📈 Pola 30 hari:'); d.patterns.slice(0, 3).forEach((p) => L.push(`• ${p}`)) }
  if (d.recommendations?.length) { L.push('💡 Rekomendasi minggu ini:'); d.recommendations.slice(0, 3).forEach((r, i) => L.push(`${i + 1}. ${r}`)) }
  L.push('_(analisis otomatis tiap Senin 10:00 WIB — detail di Ruang Data Analyst /kantor-ceo)_')
  return L.join('\n').slice(0, 1900)
}

/* ============================================================
   AGEN 7 — FARHAN (GROWTH HACKER): funnel nyata + eksperimen
   Ukur pendaftar → aktivasi (upload trade pertama) → PRO →
   referral, cari titik bocor terbesar, usulkan 3 eksperimen.
   Synch dengan Dewi: insight DA dipakai sebagai bahan.
   ============================================================ */
interface GhExperiment { name: string; how: string; metric: string; effort: string }
interface GhInsight {
  at: string
  provider: 'gemini' | 'openrouter' | 'fallback'
  insight: string
  experiments: GhExperiment[]
  funnel: { total: number; pro: number; baru7: number; referred: number; onboarded: number; activated7: number }
  dupToday?: boolean
}

async function growthAgent(e: Env): Promise<GhInsight> {
  let total = 0, pro = 0, baru7 = 0, referred = 0, onboarded = 0
  try {
    ;[total, pro, baru7, referred, onboarded] = await Promise.all([
      supaCount(e, 'profiles'),
      supaCount(e, 'profiles', 'is_pro=eq.true'),
      supaCount(e, 'profiles', 'created_at=gte.' + isoAgo(24 * 7)),
      supaCount(e, 'profiles', 'referred_by_code=not.is.null'),
      supaCount(e, 'profiles', 'onboarding_completed=eq.true'),
    ])
  } catch (x: any) { throw new Error(String(x?.message || x)) }

  /* Aktivasi: pendaftar baru 7 hari yang sudah upload trade */
  let activated7 = 0
  try {
    const res = await fetch(`${sbUrl(e)}/rest/v1/profiles?select=id&created_at=gte.${encodeURIComponent(isoAgo(24 * 7))}&limit=300`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    const ids = res.ok ? ((await res.json()) as { id?: string }[]).map((r) => r.id).filter(Boolean) as string[] : []
    if (ids.length) {
      const active7 = await fetchActiveUserIds(e, isoAgo(24 * 7))
      activated7 = ids.filter((id) => active7.has(id)).length
    }
  } catch { /* opsional — aktivasi 0 kalau gagal */ }

  const funnel = { total, pro, baru7, referred, onboarded, activated7 }
  const base = { at: new Date().toISOString(), funnel }
  if (!total) {
    const out: GhInsight = { ...base, provider: 'fallback', insight: 'Belum ada pendaftar — fokus pertama: distribusi konten (TikTok CMO) sebelum eksperimen funnel.', experiments: [] }
    await kvSet(e, 'gh:last', JSON.stringify(out)).catch(() => {})
    return out
  }

  let daLine = ''
  try { const d = JSON.parse((await kvGet(e, 'da:last')) || 'null'); if (d?.insight) daLine = `\nINSIGHT DATA ANALYST (Dewi) TERBARU: "${String(d.insight).slice(0, 220)}"` } catch { /* ignore */ }

  const funnelText =
    `FUNNEL LUXTRADEE (nyata):\n` +
    `- Total pendaftar: ${total} · User PRO: ${pro} (${total ? Math.round((pro / total) * 100) : 0}%)\n` +
    `- Pendaftar baru 7 hari: ${baru7} — ${activated7} di antaranya sudah upload trade (aktivasi ${baru7 ? Math.round((activated7 / baru7) * 100) : 0}%)\n` +
    `- User datang dari referral: ${referred} · Selesai onboarding: ${onboarded}`

  const systemPrompt =
    `Kamu Farhan, Growth Hacker Luxtradee (jurnal trading XAUUSD). Usulkan 3 EKSPERIMEN pertumbuhan yang bisa dieksekusi minggu ini — prioritas dampak besar dengan effort rendah. ` +
    `OUTPUT HANYA JSON valid (tanpa markdown): {"insight":"maks 2 kalimat soal titik bocor funnel terbesar","experiments":[{"name":"nama singkat","how":"langkah konkret 1-2 kalimat","metric":"metrik keberhasilan terukur","effort":"rendah|sedang|tinggi"}]} — bahasa Indonesia.`

  let provider: GhInsight['provider'] = 'fallback'
  let insight = '', experiments: GhExperiment[] = []
  let raw = ''
  try {
    /* SOP Multi-Agent — FARHAN (GH) rancang eksperimen pakai modelnya sendiri → Gemini cadangan */
    const brain = await agentBrain(e, 'gh', systemPrompt, funnelText + daLine + (await memBlock(e)) + `\nTanggal: ${wibNow()}`, 1024, 0.6)
    raw = brain.text
    provider = brain.provider
  } catch { raw = '' }
  if (raw) {
    try {
      const j2 = JSON.parse(extractJsonLoose(raw) || raw)
      insight = String(j2.insight || '').slice(0, 400)
      experiments = Array.isArray(j2.experiments)
        ? j2.experiments.slice(0, 3).map((x: any) => ({
            name: String(x?.name || '').slice(0, 120),
            how: String(x?.how || '').slice(0, 260),
            metric: String(x?.metric || '').slice(0, 120),
            effort: String(x?.effort || 'sedang').slice(0, 20),
          })).filter((x: GhExperiment) => x.name)
        : []
    } catch { raw = '' }
  }
  if (!insight || !experiments.length) {
    /* Fallback TANPA LLM — tetap dari funnel nyata */
    provider = 'fallback'
    const akt = baru7 ? Math.round((activated7 / baru7) * 100) : 0
    insight = `Titik bocor terbesar: aktivasi pendaftar baru cuma ${akt}% (${activated7}/${baru7}) dan konversi PRO ${total ? Math.round((pro / total) * 100) : 0}%.`
    experiments = [
      { name: 'Email aktivasi 24 jam', how: 'Pendaftar baru yang belum upload dalam 24 jam dapat 1 email: "upload 1 screenshot, evaluasi AI jalan dalam 2 menit".', metric: 'Aktivasi pendaftar baru naik ke >30%', effort: 'rendah' },
      { name: 'Social proof di landing', how: 'Tampilkan jumlah trade ter-evaluasi & win rate agregat (data Dewi) di landing page.', metric: 'Konversi kunjungan → daftar naik', effort: 'sedang' },
      { name: 'Reward referral 2 arah', how: `Benefit PRO untuk pengundang & diundang. Saat ini baru ${referred} user dari referral — potensi gratis belum digarap.`, metric: 'Pendaftar dari referral mingguan naik', effort: 'sedang' },
    ]
  }
  const out: GhInsight = { ...base, provider, insight, experiments }
  await kvSet(e, 'gh:last', JSON.stringify(out)).catch(() => {})
  if (insight) await memAdd(e, 'GH Farhan', `Funnel (${funnel.total} pendaftar, PRO ${funnel.pro}): ${insight}`)
  return out
}

function ghToDiscord(g: GhInsight): string {
  const L = ['🚀 **GROWTH HACKER — RANCANGAN EKSPERIMEN (Farhan)**', `🔍 ${g.insight}`]
  if (g.funnel) L.push(`📉 Funnel: ${fmtN(g.funnel.total)} pendaftar · ${fmtN(g.funnel.pro)} PRO · aktivasi baru 7 hr ${g.funnel.baru7 ? Math.round((g.funnel.activated7 / g.funnel.baru7) * 100) : 0}% · ${fmtN(g.funnel.referred)} dari referral`)
  if (g.experiments?.length) {
    L.push('🧪 Eksperimen prioritas:')
    g.experiments.slice(0, 3).forEach((x, i) => L.push(`${i + 1}. **${x.name}** (effort ${x.effort}) → ${x.metric}\n   ${x.how}`))
  }
  L.push('_(rancangan otomatis tiap Senin 10:00 WIB — detail di Ruang Growth /kantor-ceo)_')
  return L.join('\n').slice(0, 1900)
}

/* ---------- NEXT BEST ACTION (CEO pintar): 1 prioritas/hari ----------
   Setelah briefing tersusun, Alexander pilih SATU aksi terpenting yang
   HANYA Bos yang bisa kerjakan hari ini → dikirim ke Discord sebagai
   pesan terpisah + tampil di Ruang Rapat. 1 panggilan LLM/hari. */
async function nextBestAction(e: Env, briefingText: string): Promise<string> {
  try {
    /* SOP Multi-Agent — Alexander (CEO, Llama 3.1 8B) pilih prioritas;
       tidak lagi tergantung Gemini. */
    const brain = await agentBrain(
      e, 'ceo',
      'Kamu wakil CEO Luxtradee (jurnal trading XAUUSD). Dari briefing pagi di bawah, tentukan SATU aksi prioritas tertinggi yang Bos harus kerjakan HARI INI — yang paling berdampak ke pertumbuhan atau paling urgent, dan HANYA Bos yang bisa (bukan yang bisa dikerjakan karyawan AI). LIHAT MEMORI KANTOR: jangan pilih prioritas yang mirip dengan yang sudah dipilih hari-hari sebelumnya kecuali benar-benar masih paling penting. Format jawaban HANYA: "🎯 <aksi konkret> — <alasan 1 kalimat>". Maks 200 karakter, bahasa Indonesia.',
      briefingText.slice(0, 1600) + (await memBlock(e, 5)), 200, 0.4,
    )
    const nba = brain.text
    const text = nba.split('\n').filter((s) => s.trim()).slice(0, 2).join(' ').trim().slice(0, 300)
    if (!text) return ''
    await kvSet(e, 'nba:last', JSON.stringify({ at: new Date().toISOString(), text })).catch(() => {})
    await memAdd(e, 'CEO Alexander', `Prioritas Bos hari ini: ${text.replace(/^🎯\s*/, '')}`)
    try { await sendDiscord(e, `${text}\n_(dipilih otomatis dari briefing pagi — 1 prioritas saja, biar fokus)_`) } catch { /* ignore */ }
    return text
  } catch { return '' }
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

/* URL TikTok valid: link panjang (www/m) ATAU link pendek share (vt/vm)
   — contoh: https://vt.tiktok.com/ZSgQjsxYP/ */
const TT_URL_RE = /^https:\/\/(www\.|m\.|vt\.|vm\.)?tiktok\.com\/[^\s]+$/i

async function tikTokAdd(e: Env, body: { url?: string; views?: number; likes?: number; comments?: number; caption?: string }) {
  const postUrl = String(body.url || '').trim()
  if (!TT_URL_RE.test(postUrl)) throw new Error('URL TikTok tidak valid — contoh: https://www.tiktok.com/@username/video/123456789 atau link pendek https://vt.tiktok.com/ZSgQjsxYP')
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('set SUPABASE_SERVICE_ROLE_KEY dulu di Cloudflare (butuh bypass RLS)')

  /* Link pendek vt/vm → resolve redirect ke URL video asli dulu supaya
     oEmbed bisa baca caption (vt.tiktok.com sering ditolak oEmbed).
     Canonical hanya dipakai kalau hasil redirect benar-benar URL video
     (bukan halaman about/login yang kadang jadi tujuan redirect). */
  let canonical = postUrl
  if (/^https:\/\/(vt|vm)\.tiktok\.com\//i.test(postUrl)) {
    try {
      const r0 = await fetch(postUrl, { redirect: 'follow', signal: timeoutSignal(10_000) })
      if (r0.ok && /^https:\/\/(www\.|m\.)?tiktok\.com\//i.test(r0.url) && /\/(video|photo)\//i.test(r0.url)) canonical = r0.url
    } catch { /* gagal resolve → coba oEmbed dengan URL asli */ }
  }

  /* oEmbed TikTok: gratis, tanpa API key → caption + thumbnail otomatis */
  let caption = String(body.caption || '').trim()
  let thumbnail = ''
  let autoCaption = false
  try {
    let oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`, { signal: timeoutSignal(10_000) })
    if (!oe.ok && canonical !== postUrl)
      oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`, { signal: timeoutSignal(10_000) })
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

  if (action !== 'info' && action !== 'quota' && action !== 'briefing-last' && action !== 'talk' && action !== 'talk-last' && action !== 'mem-last' && action !== 'analyst-last' && action !== 'growth-last') {
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
      // ?only=cto,cso,cfo,coo — jalankan subset agen (draf TikTok CMO
      // di-cache 1×/hari sesuai SOP "1 draf/hari" — hemat kuota model)
      const only = (url.searchParams.get('only') || '').split(',').map((s) => s.trim()).filter(Boolean)
      const want = (w: string) => !only.length || only.includes(w)
      const [cto, cso, cmo, cfo, coo] = await Promise.all([
        want('cto') ? ctoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cso') ? csoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cmo') ? cmoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cfo') ? cfoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('coo') ? cooPending(e).catch(() => ({ pending: 0, approved24h: 0 })) : Promise.resolve(undefined),
      ])
      return j({ cto, cso, cmo, cfo, coo })
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
          OPENROUTER_API_KEY: has('OPENROUTER_API_KEY'),
          OPENROUTER_MODEL: has('OPENROUTER_MODEL'),
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
    case 'qa':
      // CTO QA sweep — tes semua fitur/route utama (juga jalan otomatis di briefing 08:00)
      return j(await qaAgent(e))
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
    case 'talk':
      // Diskusi CSO × CMO (Ruang CSO): akar masalah user pasif + skrip konten.
      // Dedup per hari — kalau sudah jalan pagi ini, balikin hasil yang tersimpan.
      // Respons dibungkus {talk} — tanpa key `error` di root supaya state
      // dashboard ruangan lain tidak ikut menampilkan pesan ini.
      try {
        const dayKey = `cso-cmo:${utcDay()}`
        if (await kvGet(e, dayKey)) {
          const last = await kvGet(e, 'cso-cmo:last')
          return last ? j({ talk: { ...JSON.parse(last), dupToday: true } }) : j({ talk: await csoCmoTalk(e) })
        }
        await kvSet(e, dayKey, new Date().toISOString())
        return j({ talk: await csoCmoTalk(e) })
      } catch (x: any) { return j({ talkError: String(x?.message || x).slice(0, 160) }, 200) }
    case 'talk-last': {
      // Hasil diskusi CSO × CMO terakhir (dipakai Ruang CSO saat dibuka).
      // Selalu bentuk {talk} — tanpa key `error` di root (tidak bocor ke
      // panel ruangan lain). Gagal baca KV → talk:null (panel tampil kosong).
      try {
        const last = await kvGet(e, 'cso-cmo:last')
        return last ? j({ talk: JSON.parse(last) }) : j({ talk: null })
      } catch { return j({ talk: null }) }
    }
    case 'mem-last': {
      // 🧠 Memori Kantor — catatan kesimpulan bersama semua karyawan AI
      // (Ruang Rapat). Tanpa ENV check — memori opsional, selalu aman.
      try { return j({ mem: await memList(e) }) } catch { return j({ mem: [] }) }
    }
    case 'analyst': {
      // Dewi (Data Analyst) — analisis trades 30 hari → insight + rekomendasi.
      // Dedup per hari; kirim Discord (pesan terpisah) tiap hasil baru.
      try {
        const dk = `da:${utcDay()}`
        if (await kvGet(e, dk)) {
          const last = await kvGet(e, 'da:last')
          return last ? j({ da: { ...JSON.parse(last), dupToday: true } }) : j({ da: await analystAgent(e) })
        }
        await kvSet(e, dk, new Date().toISOString())
        const da = await analystAgent(e)
        try { await sendDiscord(e, daToDiscord(da)) } catch { /* ignore */ }
        return j({ da })
      } catch (x: any) { return j({ daError: String(x?.message || x).slice(0, 160) }, 200) }
    }
    case 'analyst-last': {
      // Hasil analisis Dewi terakhir (panel Ruang Data Analyst saat dibuka)
      try {
        const last = await kvGet(e, 'da:last')
        return last ? j({ da: JSON.parse(last) }) : j({ da: null })
      } catch { return j({ da: null }) }
    }
    case 'growth': {
      // Farhan (Growth Hacker) — funnel nyata + 3 eksperimen minggu ini.
      // Dedup per hari; kirim Discord (pesan terpisah) tiap hasil baru.
      try {
        const gk = `gh:${utcDay()}`
        if (await kvGet(e, gk)) {
          const last = await kvGet(e, 'gh:last')
          return last ? j({ gh: { ...JSON.parse(last), dupToday: true } }) : j({ gh: await growthAgent(e) })
        }
        await kvSet(e, gk, new Date().toISOString())
        const gh = await growthAgent(e)
        try { await sendDiscord(e, ghToDiscord(gh)) } catch { /* ignore */ }
        return j({ gh })
      } catch (x: any) { return j({ ghError: String(x?.message || x).slice(0, 160) }, 200) }
    }
    case 'growth-last': {
      // Hasil rancangan Farhan terakhir (panel Ruang Growth saat dibuka)
      try {
        const last = await kvGet(e, 'gh:last')
        return last ? j({ gh: JSON.parse(last) }) : j({ gh: null })
      } catch { return j({ gh: null }) }
    }
    default:
      return j({
        app: 'Luxtrade Super AI Agent — Multi-Agent (SOP: tiap karyawan model OpenRouter sendiri)',
        models: {
          COO_Bagas: AGENT_MODELS.coo,
          CTO_Raka: AGENT_MODELS.cto,
          CSO_Maya: AGENT_MODELS.cso,
          CMO_Sinta: AGENT_MODELS.cmo,
          CFO_Putri: 'TANPA LLM — murni matematika hardcoded',
          CEO_Alexander: AGENT_MODELS.ceo,
        },
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
          'action=qa — CTO tes semua fitur dashboard (12 route) → hasil ikut laporan 08:00',
          'action=weekly — laporan mingguan 7 hari ke Discord (cron Minggu 20:00)',
          'action=tiktok-list — daftar bahan analisis TikTok (Ruang CMO)',
          'action=tiktok-add (POST JSON {url,views,likes}) — tambah post: caption auto via oEmbed',
          'action=tiktok-del (?id=) — hapus post bahan analisis',
          'action=talk — diskusi harian CSO × CMO: akar masalah user pasif + skrip konten (Ruang CSO)',
          'action=talk-last — hasil diskusi CSO × CMO terakhir',
          'action=mem-last — 🧠 Memori Kantor: kesimpulan bersama semua karyawan AI (Ruang Rapat)',
          'action=analyst — Dewi (Data Analyst): trades 30 hari → insight + 3 rekomendasi (Ruang DA, cron Senin)',
          'action=analyst-last — hasil analisis Dewi terakhir',
          'action=growth — Farhan (Growth Hacker): funnel + 3 eksperimen growth (Ruang GH, cron Senin)',
          'action=growth-last — hasil rancangan Farhan terakhir',
          'action=discord-test — kirim pesan tes ke Discord (diagnosa)',
        ],
      })
  }
}

export const GET = handle
export const POST = handle
