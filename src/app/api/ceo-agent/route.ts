// app/api/ceo-agent/route.ts — LUXTRADE SUPER AI AGENT (Ruang CEO)
// Next.js API Route · Edge Runtime · target deploy: Cloudflare Workers (OpenNext)
// Fetch native. TANPA Vercel AI SDK. TANPA Hono. TANPA node-fetch.
// Auth: header "Authorization: Bearer ADMIN_SECRET" atau ?key=CRON_SECRET
// Cron 08:00 WIB: cron-job.org → /api/ceo-agent?action=briefing&key=CRON_SECRET
// ============================================================
// Catatan adaptasi utk project Luxtradee (tanpa mengubah perilaku):
//  - SUPABASE_URL / SUPABASE_ANON_KEY fallback ke NEXT_PUBLIC_* bila belum diset
//  - SITE_URL & alamat email pakai domain produksi luxtradee.web.id
// ============================================================
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

interface Env { [k: string]: string | undefined }

/* ---------- konfigurasi kolom — SESUAIKAN dgn skema Supabase-mu ---------- */
const COL = {
  errorTime: 'created_at',        // tabel error_logs → kolom waktu error
  userActivity: 'last_upload_at', // tabel users      → kolom upload terakhir
  userEmail: 'email',             // tabel users      → kolom email
}
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
  return (e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
}
function sbAnonKey(e: Env) {
  return e.SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}
function sbH(e: Env) {
  return { apikey: sbAnonKey(e), Authorization: `Bearer ${sbAnonKey(e)}` }
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
async function supaCount(e: Env, table: string, filters = ''): Promise<number> {
  const url = `${sbUrl(e)}/rest/v1/${table}?select=*&limit=1${filters ? '&' + filters : ''}`
  const res = await fetch(url, { headers: { ...sbH(e), Prefer: 'count=exact' }, signal: timeoutSignal(10_000) })
  if (!res.ok) throw new Error(`Supabase ${table} HTTP ${res.status}`)
  const cr = res.headers.get('content-range') || '' // "0-0/1240" atau "*/0"
  const total = parseInt(cr.split('/')[1] || '', 10)
  if (!Number.isFinite(total)) throw new Error(`content-range tidak terbaca: "${cr}"`)
  return total
}

/* ============================================================
   AGEN 1 — CTO (IT & QA): ping situs + bug 24 jam
   ============================================================ */
async function ctoAgent(e: Env) {
  const t0 = Date.now()
  let status = 0, siteOk = false, err = ''
  try {
    const res = await fetch(SITE_URL, { method: 'GET', redirect: 'follow', signal: timeoutSignal(15_000) })
    status = res.status; siteOk = res.ok
  } catch (x: any) { err = String(x?.message || x) }
  const latencyMs = Date.now() - t0

  let bugs24h = -1
  try { bugs24h = await supaCount(e, 'error_logs', `${COL.errorTime}=gte.${isoAgo(24)}`) }
  catch (x: any) { err = err || String(x?.message || x) }
  return { title: 'CTO — IT & QA', siteOk, status, latencyMs, bugs24h, err }
}

/* ============================================================
   AGEN 2 — CSO (Customer Success): pendaftar / aktif / pasif
   ============================================================ */
async function csoAgent(e: Env) {
  const since = isoAgo(24)
  const [total, active, passive] = await Promise.all([
    supaCount(e, 'users'),
    supaCount(e, 'users', `${COL.userActivity}=gte.${since}`),
    supaCount(e, 'users', `or=(${COL.userActivity}.is.null,${COL.userActivity}.lt.${since})`),
  ])
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
  const model = e.GEMINI_MODEL || 'gemini-1.5-flash'
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
        generationConfig: { temperature: 1.0, maxOutputTokens: 1024 },
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

/* ---------- WhatsApp Gateway ---------- */
async function sendWA(e: Env, message: string) {
  if (e.WA_PROVIDER === 'wablas') {
    const res = await fetch('https://console.wablas.com/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: e.WA_TOKEN || '' },
      body: JSON.stringify({ phone: e.WA_TARGET, message }),
      signal: timeoutSignal(15_000),
    })
    if (!res.ok) throw new Error(`Wablas HTTP ${res.status}`)
    return true
  }
  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: e.WA_TOKEN || '' },
    body: JSON.stringify({ target: e.WA_TARGET, message }),
    signal: timeoutSignal(15_000),
  })
  if (!res.ok) throw new Error(`Fonnte HTTP ${res.status}`)
  return true
}

/* ---------- Morning Briefing (gabungan 4 agen) ---------- */
function buildBriefing(cto: any, cso: any, cmo: any, cfo: any): string {
  const L: string[] = []
  L.push('🌅 *MORNING BRIEFING — LUXTRADE SUPER AI*')
  L.push(`📅 ${wibNow()} · 08:00 WIB`)
  L.push('━━━━━━━━━━━━━━━━━━')
  L.push('🖥️ *CTO AGENT — IT & QA*')
  L.push(cto?.siteOk
    ? `• Website: ✅ ${cto.status} OK (${cto.latencyMs} ms)`
    : `• Website: ❌ DOWN (${cto?.status || 'timeout'})${cto?.err ? ' — ' + String(cto.err).slice(0, 80) : ''}`)
  L.push(cto?.bugs24h > 0 ? `• Bug 24 jam terakhir: ${cto.bugs24h} ⚠️ segera cek error_logs`
    : cto?.bugs24h === 0 ? '• Bug 24 jam terakhir: 0 ✅'
    : '• Bug 24 jam: data gagal diambil ⚠️')
  L.push('')
  L.push('👥 *CSO AGENT — CUSTOMER SUCCESS*')
  L.push(`• Total pendaftar: ${fmtN(cso?.total)}`)
  L.push(`• User aktif (upload 24 jam): ${fmtN(cso?.active)}`)
  L.push(`• User pasif (>24 jam tanpa aktivitas): ${fmtN(cso?.passive)}`)
  L.push('')
  L.push('📣 *CMO AGENT — DRAF TIKTOK HARI INI*')
  L.push(cmo?.draft ? `—\n${cmo.draft}\n—` : '• Gagal generate draf ⚠️')
  if (cmo?.usedFallback) L.push('_(Gemini limit — pakai draf cadangan, mohon revisi manual)_')
  L.push('')
  L.push('💰 *CFO AGENT — KUOTA API GEMINI*')
  L.push(`• Terpakai kemarin: ${fmtN(cfo?.usedYesterday)}/${fmtN(cfo?.limit)}`)
  L.push(`• Terpakai hari ini: ${fmtN(cfo?.usedToday)}/${fmtN(cfo?.limit)}`)
  L.push(`• Event 429 kemarin: ${fmtN(cfo?.quota429)}`)
  L.push(`• Status: ${cfo?.status || '-'}`)
  L.push('━━━━━━━━━━━━━━━━━━')
  L.push("Bos, balas 'ACC EMAIL' jika ingin CSO mengirim email sapaan ke user pasif hari ini.")
  return L.join('\n')
}

async function runMorningBriefing(e: Env) {
  const [cto, cso, cmo, cfo] = await Promise.all([
    ctoAgent(e).catch((x: any) => ({ siteOk: false, status: 0, latencyMs: 0, bugs24h: -1, err: String(x?.message || x) })),
    csoAgent(e).catch((x: any) => ({ total: -1, active: -1, passive: -1, err: String(x?.message || x) })),
    cmoAgent(e).catch((x: any) => ({ draft: '', angle: '', usedFallback: false, error: String(x?.message || x) })),
    cfoAgent(e).catch(() => ({ limit: 0, usedToday: 0, usedYesterday: 0, quota429: 0, status: 'error' })),
  ])
  const text = buildBriefing(cto, cso, cmo, cfo)
  let waSent = false, waErr = ''
  try { await sendWA(e, text); waSent = true } catch (x: any) { waErr = String(x?.message || x) }
  const summary = { at: new Date().toISOString(), waSent, waErr, cto, cso, cmo, cfo, text }
  await kvSet(e, 'briefing:last', JSON.stringify(summary))
  return summary
}

/* ---------- flow "ACC EMAIL": email ke user pasif ---------- */
async function sendPassiveEmails(e: Env): Promise<number> {
  const since = isoAgo(24)
  const url = `${sbUrl(e)}/rest/v1/users?select=${COL.userEmail}&or=(${COL.userActivity}.is.null,${COL.userActivity}.lt.${since})&limit=50`
  const res = await fetch(url, { headers: sbH(e), signal: timeoutSignal(10_000) })
  if (!res.ok) throw new Error(`Supabase users HTTP ${res.status}`)
  const rows: any[] = await res.json()
  const emails = rows.map((r) => r?.[COL.userEmail]).filter(Boolean)
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

  if (action !== 'info' && !(isCron || isAdmin))
    return j({ error: 'unauthorized — tambahkan ?key=CRON_SECRET/ADMIN_SECRET atau header Authorization: Bearer <ADMIN_SECRET>' }, 401)

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
      const [cto, cso, cmo, cfo] = await Promise.all([
        ctoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })),
        csoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })),
        cmoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })),
        cfoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })),
      ])
      return j({ cto, cso, cmo, cfo })
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
    case 'webhook': {
      // Webhook WA (Fonnte) — URL: /api/ceo-agent?action=webhook&key=<ADMIN_SECRET>
      const body = await req.json().catch(() => ({}) as any)
      const text = String(body?.message ?? body?.text ?? '').trim().toUpperCase()
      if (!text.includes('ACC EMAIL')) return j({ ok: true, ignored: true })
      const day = utcDay()
      if (await kvGet(e, `acc_email:${day}`)) return j({ ok: true, dup: true })
      await kvSet(e, `acc_email:${day}`, new Date().toISOString())
      let emailsSent = -1
      if (e.RESEND_API_KEY) { try { emailsSent = await sendPassiveEmails(e) } catch { /* ignore */ } }
      const reply = emailsSent >= 0
        ? `Siap Bos! ✅ Email sapaan terkirim ke ${emailsSent} user pasif hari ini.`
        : 'Siap Bos! ✅ ACC EMAIL dicatat. Set RESEND_API_KEY agar email terkirim otomatis.'
      try { await sendWA(e, reply) } catch { /* ignore */ }
      return j({ ok: true, accEmail: true, emailsSent })
    }
    default:
      return j({
        app: 'Luxtrade Super AI Agent',
        actions: [
          'action=briefing (POST/GET) — jalankan 4 agen + kirim WA',
          'action=agents — data 4 agen tanpa kirim WA',
          'action=quota — laporan kuota (CFO)',
          'action=quota-track (POST) — gerbang anti-429 sebelum Gemini Vision',
          'action=briefing-last — briefing terakhir',
          'action=webhook (POST) — webhook Fonnte untuk "ACC EMAIL"',
        ],
      })
  }
}

export const GET = handle
export const POST = handle
