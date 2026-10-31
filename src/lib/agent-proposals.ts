/**
 * ============================================================
 * AGENT PROPOSALS — jantung sistem "Agen Otonom (Agentic)
 * dengan Human-in-the-Loop" — Task 34 (Major Update, SOP Bos)
 * ============================================================
 *
 * PERUBAHAN ARSITEKTUR: karyawan AI tidak lagi "Pasif Pelapor"
 *   (cuma bikin laporan) — sekarang mereka AGEN OTONOM yang
 *   mengusulkan TINDAKAN, tapi eksekusi tetap di tangan CEO:
 *
 *   1. DETEKSI (kode Next.js, data RIIL — bukan karangan LLM):
 *      tiap agen punya detektor trigger (di file ini).
 *   2. PROPOSAL: kalau trigger kena → INSERT ke tabel Supabase
 *      `ai_pending_actions` status 'pending' (dengan dedup).
 *      Konten naratif (judul konten / subjek email / pesan) ditulis
 *      LLM via kontrak JSON WAJIB: { laporan, proposed_action } —
 *      angka HANYA dari blok DATA RIIL (anti-halusinasi, warisan
 *      Task 32). Kalau LLM gagal → payload templat deterministik
 *      dari angka riil (proposal tetap jalan, jujur).
 *   3. KEPUTUSAN: CEO ACC/Tolak di Dashboard Alexander
 *      (komponen PendingActionsQueue) → /api/execute-action.
 *   4. EKSEKUSI NYATA di /api/execute-action (Resend, Meta Graph
 *      API, blog_posts, Discord, feature flag) → status 'approved'.
 *
 * ATURAN JUJUR: TIDAK ADA mock data. Kalau tabel Supabase belum
 * dibuat (migration 015 belum dijalankan), semua fungsi balik
 * { ok:false, reason:'TABLE_MISSING' } — tidak crash, tidak pura2.
 */

import { bagasCooldownSince, bagasCooldownOrFilter, contactsFromTaskRows, emailsFromActionRows } from '@/lib/bagas-cooldown'

/* ================= ENV RESOLUTION ================= */

/** Baca secret dari process.env ATAU binding CF Workers (pola meta-post). */
export function envGet(name: string): string {
  const direct = process.env[name]
  if (direct) return direct.trim()
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
    const v = ctx?.env?.[name]
    if (v) return String(v).trim()
  } catch { /* ignore */ }
  return ''
}

export interface SbConfig { url: string; anon: string; service: string }

export function sbConfig(): SbConfig {
  const url = (envGet('SUPABASE_URL') || envGet('NEXT_PUBLIC_SUPABASE_URL') || '').replace(/\/$/, '')
  const anon = envGet('SUPABASE_ANON_KEY') || envGet('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const service = envGet('SUPABASE_SERVICE_ROLE_KEY') || anon
  return { url, anon, service }
}

export function ownerEmail(): string {
  return (envGet('OWNER_EMAIL') || 'luxtradee@gmail.com').toLowerCase()
}

const SB_TIMEOUT = 10_000

function sbHeadersPriv(cfg: SbConfig): Record<string, string> {
  return { apikey: cfg.anon, Authorization: `Bearer ${cfg.service}` }
}

/* ================= WAKTU ================= */

export function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString()
}
/* Task 35g: WIB (UTC+7) — dulu UTC: jam 00:00–06:59 WIB key harian masih "kemarin",
   hitungan kuota CFO Putri & resend_sent terbaca salah key (taku utama ceo-agent route). */
export function wibDay(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

/* ================= SUPABASE REST CORE ================= */

async function sbSelect(cfg: SbConfig, table: string, query: string): Promise<{ ok: boolean; rows: any[]; status: number }> {
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}?${query}`, {
      headers: sbHeadersPriv(cfg),
      signal: AbortSignal.timeout(SB_TIMEOUT),
    })
    if (!res.ok) return { ok: false, rows: [], status: res.status }
    return { ok: true, rows: (await res.json()) as any[], status: 200 }
  } catch {
    return { ok: false, rows: [], status: 0 }
  }
}

async function sbInsert(cfg: SbConfig, table: string, row: Record<string, unknown>): Promise<{ ok: boolean; row?: any; status: number }> {
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...sbHeadersPriv(cfg), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(SB_TIMEOUT),
    })
    if (!res.ok) return { ok: false, status: res.status }
    const rows = (await res.json().catch(() => [])) as any[]
    return { ok: true, row: rows?.[0], status: 201 }
  } catch {
    return { ok: false, status: 0 }
  }
}

/** Hitung baris (Prefer: count=exact) — untuk detektor konversi. */
async function sbCountExact(cfg: SbConfig, table: string, filters: string): Promise<number> {
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}?select=*&limit=1${filters ? '&' + filters : ''}`, {
      headers: { ...sbHeadersPriv(cfg), Prefer: 'count=exact' },
      signal: AbortSignal.timeout(SB_TIMEOUT),
    })
    const range = res.headers.get('content-range') || ''
    const total = parseInt(range.split('/')[1] || '0', 10)
    return Number.isFinite(total) ? total : 0
  } catch {
    return -1
  }
}

/* ================= agent_kv (tabel Supabase, pola ceo-agent) ================= */

export async function kvGetKey(cfg: SbConfig, key: string): Promise<string | null> {
  const r = await sbSelect(cfg, 'agent_kv', `select=value&key=eq.${encodeURIComponent(key)}&limit=1`)
  return r.ok ? (r.rows?.[0]?.value ?? null) : null
}

export async function kvSetKey(cfg: SbConfig, key: string, value: string): Promise<boolean> {
  try {
    const res = await fetch(`${cfg.url}/rest/v1/agent_kv?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbHeadersPriv(cfg), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value }),
      signal: AbortSignal.timeout(SB_TIMEOUT),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function kvIncrKey(cfg: SbConfig, key: string): Promise<number> {
  const cur = parseInt((await kvGetKey(cfg, key)) || '0', 10)
  await kvSetKey(cfg, key, String(cur + 1))
  return cur + 1
}

/* ================= OPENROUTER — kontrak JSON agen ================= */

/**
 * 1 panggilan OpenRouter dengan kontrak output WAJIB JSON:
 * { "laporan": "...", "proposed_action": { ... } }
 * (FASE 2 SOP Bos). Angka wajib dari blok DATA RIIL di prompt.
 * Gagal / JSON rusak → null (caller pakai templat deterministik).
 */
/* Task 35: katalog gratis OpenRouter dikurasi ulang — model lama
   (gemma-2-9b:free, llama-3.1-8b:free, glm-4.7-flash) 404 SEMUA → inilah
   dulu penyebab semua proposal jadi templat. Kini rantai model hidup
   (diverifikasi GET /api/v1/models): primary per agen + 3 cadangan.
   Catatan limit gratis OpenRouter: 20 req/menit; 50/hari tanpa kredit,
   1000/hari kalau saldo ≥ $10. */
const OR_LIVE_CHAIN = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
]

export interface OrJsonResult { laporan?: string; proposed_action?: any; ai_model?: string; ai_error?: string }

/**
 * 1 panggilan OpenRouter dengan kontrak output WAJIB JSON:
 * { "laporan": "...", "proposed_action": { ... } }
 * (FASE 2 SOP Bos). Angka wajib dari blok DATA RIIL di prompt.
 * Sukses → { laporan, proposed_action, ai_model }.
 * Gagal total → { ai_error: "alasan jujur" } (caller tandai templat,
 * BOS LIHAT ALASANNYA di dashboard — tidak ada error yang ditelan).
 */
export async function orJson(systemPrompt: string, userPrompt: string, model: string, agentTag: string, maxTokens = 800, cfg?: SbConfig): Promise<OrJsonResult> {
  const key = envGet('OPENROUTER_API_KEY')
  if (!key) {
    console.error(`[agent-proposals:${agentTag}] OPENROUTER_API_KEY tidak tersedia — proposal pakai templat data riil`)
    return { ai_error: 'OPENROUTER_API_KEY tidak tersedia di server' }
  }
  let chain = [...new Set([model, ...OR_LIVE_CHAIN])].filter(Boolean)
  /* Circuit breaker (Task 35c) — konvensi kunci `or:sick:<model>` SAMA dengan
     ceo-agent/route.ts → kesehatan model dibagi lintas layanan. Butuh cfg
     (Supabase) — tanpa cfg, breaker dilewati (chain tetap jalan normal). */
  const canKv = !!(cfg && cfg.url && cfg.service)
  if (canKv) {
    const SICK_MS = 10 * 60_000
    const sickFlags = await Promise.all(chain.map(async (m) => {
      try {
        const t = parseInt((await kvGetKey(cfg as SbConfig, `or:sick:${m}`)) || '0', 10)
        return !!t && Date.now() - t < SICK_MS
      } catch { return false }
    }))
    const healthy = chain.filter((_, i) => !sickFlags[i])
    if (healthy.length && healthy.length < chain.length) chain = healthy // semua sakit → coba tetap
  }
  let lastErr = ''
  for (const m of chain) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.6,
        }),
        signal: AbortSignal.timeout(45_000),
      })
      if (!res.ok) {
        lastErr = `${m} → HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 100)}`
        console.error(`[agent-proposals:${agentTag}] ${lastErr} — coba model berikutnya`)
        if (canKv && [429, 403, 500, 502, 503].includes(res.status)) {
          try { await kvSetKey(cfg as SbConfig, `or:sick:${m}`, String(Date.now())) } catch { /* opsional */ }
        }
        continue
      }
      const raw = String((await res.json() as any)?.choices?.[0]?.message?.content || '').trim()
      const cleaned = raw.replace(/```json|```/gi, '').trim()
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start < 0 || end <= start) { lastErr = `${m} → JSON tidak ditemukan di respons`; continue }
      if (canKv) { try { await kvSetKey(cfg as SbConfig, `or:sick:${m}`, '0') } catch { /* opsional */ } }
      return { ...(JSON.parse(cleaned.slice(start, end + 1)) as OrJsonResult), ai_model: m }
    } catch (x: any) {
      lastErr = `${m} → ${String(x?.message || x).slice(0, 100)}`
    }
  }
  console.error(`[agent-proposals:${agentTag}] semua ${chain.length} model gagal (${lastErr}) — pakai templat data riil`)
  return { ai_error: `Semua model OpenRouter gagal — ${lastErr}` }
}

const ANTI_HALUSINASI = `ATURAN KERAS (anti-halusinasi): gunakan HANYA angka & fakta dari blok "DATA RIIL" — DILARANG mengarang angka, nama, atau klaim. Output HANYA JSON valid tanpa teks lain.`

/* ================= PENDING ACTIONS CORE ================= */

export interface PendingAction {
  id: string
  agent_name: string
  action_type: string
  action_payload: Record<string, any>
  status: string
  created_at: string
  executed_at: string | null
  executed_result: any
}

export interface InsertResult { ok: boolean; inserted: boolean; id?: string; reason?: string }

/**
 * INSERT proposal + DEDUP: kalau sudah ada proposal (status apapun)
 * untuk agen+jenis aksi yang sama dalam window dedupMinutes → skip.
 * (Mencegah spam tiap sweep cron 15 menit; proposal yang sudah
 * DITOLAK CEO juga tidak diusulkan ulang dalam window yang sama.)
 */
export async function insertPendingAction(cfg: SbConfig, input: {
  agentName: string; actionType: string; payload: Record<string, unknown>; dedupMinutes?: number
}): Promise<InsertResult> {
  if (!cfg.url || !cfg.service) return { ok: false, inserted: false, reason: 'SB_CONFIG_MISSING' }
  const dedupMin = input.dedupMinutes ?? 24 * 60
  const since = isoAgo(dedupMin / 60)
  const dup = await sbSelect(
    cfg,
    'ai_pending_actions',
    `select=id&agent_name=eq.${encodeURIComponent(input.agentName)}&action_type=eq.${encodeURIComponent(input.actionType)}&created_at=gte.${since}&limit=1`,
  )
  if (!dup.ok) return { ok: false, inserted: false, reason: `TABLE_MISSING (HTTP ${dup.status}) — jalankan supabase-migrations/015_create_ai_pending_actions.sql` }
  if (dup.rows.length > 0) return { ok: true, inserted: false, reason: 'duplicate' }
  const ins = await sbInsert(cfg, 'ai_pending_actions', {
    agent_name: input.agentName,
    action_type: input.actionType,
    action_payload: input.payload,
    status: 'pending',
  })
  if (!ins.ok) return { ok: false, inserted: false, reason: `INSERT gagal HTTP ${ins.status}` }
  return { ok: true, inserted: true, id: ins.row?.id }
}

export async function listPendingActions(cfg: SbConfig, limit = 50): Promise<{ ok: boolean; tableReady: boolean; actions: PendingAction[] }> {
  if (!cfg.url || !cfg.service) return { ok: false, tableReady: false, actions: [] }
  const r = await sbSelect(cfg, 'ai_pending_actions', `select=*&status=eq.pending&order=created_at.desc&limit=${limit}`)
  if (!r.ok) return { ok: false, tableReady: false, actions: [] }
  return { ok: true, tableReady: true, actions: r.rows as PendingAction[] }
}

export async function decideAction(cfg: SbConfig, id: string, status: 'approved' | 'rejected', result: Record<string, unknown>): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(`${cfg.url}/rest/v1/ai_pending_actions?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...sbHeadersPriv(cfg), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status, executed_at: new Date().toISOString(), executed_result: result, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(SB_TIMEOUT),
    })
    if (!res.ok) return { ok: false, reason: `PATCH HTTP ${res.status}` }
    return { ok: true }
  } catch (x: any) {
    return { ok: false, reason: String(x?.message || x) }
  }
}

export async function getActionById(cfg: SbConfig, id: string): Promise<PendingAction | null> {
  const r = await sbSelect(cfg, 'ai_pending_actions', `select=*&id=eq.${encodeURIComponent(id)}&limit=1`)
  return r.ok ? (r.rows?.[0] ?? null) : null
}

/* ================= EMAILS USER (admin API — pola ceo-agent) ================= */

/** Email semua user (untuk broadcast Raka) — service key, cap 200. */
export async function fetchAllUserEmails(cfg: SbConfig, cap = 200): Promise<string[]> {
  const users = await fetchAllUsers(cfg, cap)
  return [...new Set(users.map(u => u.email))]
}

/** Semua user {id, email} dari Auth admin — dipakai broadcast utk suppression. */
export async function fetchAllUsers(cfg: SbConfig, cap = 250): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = []
  for (let page = 1; page <= 2 && out.length < cap; page++) {
    try {
      const res = await fetch(`${cfg.url}/auth/v1/admin/users?page=${page}&per_page=200`, {
        headers: sbHeadersPriv(cfg),
        signal: AbortSignal.timeout(SB_TIMEOUT),
      })
      if (!res.ok) break
      const data = await res.json() as any
      for (const u of (data?.users || [])) {
        const id = String(u?.id || '')
        const em = String(u?.email || '').toLowerCase().trim()
        if (id && em && em.includes('@')) out.push({ id, email: em })
      }
    } catch { break }
  }
  return out.slice(0, cap)
}

/**
 * 🚫 SUPPRESSION LIST pragmatis (penutup temuan "Raka broadcast tanpa filter
 * unsubscribe"): union user yang minta berhenti di-email dari dua kampanye
 * cron — re_engagement_emails.unsubscribed & daily_reminder_logs.unsubscribed.
 * Dipakai jalur agen (broadcast maintenance, dll). FAIL-OPEN: tabel belum ada
 * / query gagal → set kosong (broadcast tetap jalan — email operasional).
 */
export async function fetchUnsubscribedUserIds(cfg: SbConfig): Promise<Set<string>> {
  const out = new Set<string>()
  for (const table of ['re_engagement_emails', 'daily_reminder_logs']) {
    try {
      const res = await fetch(`${cfg.url}/rest/v1/${table}?select=user_id&unsubscribed=eq.true&limit=1000`, {
        headers: sbHeadersPriv(cfg),
        signal: AbortSignal.timeout(SB_TIMEOUT),
      })
      if (!res.ok) continue
      const rows = await res.json() as Array<{ user_id?: unknown }>
      for (const r of rows) if (r?.user_id) out.add(String(r.user_id))
    } catch { /* tabel belum ada → skip */ }
  }
  return out
}

/* ============================================================
   DETEKTOR TRIGGER — 7 AGEN (semua dari DATA RIIL)
   ============================================================ */

export interface DetectedProposal { agentName: string; actionType: string; payload: Record<string, unknown>; dedupMinutes?: number }

/* ---------- SINTA (CMO): momen market XAUUSD dari API eksternal ---------- */
export async function sintaMarketProposal(cfg: SbConfig): Promise<DetectedProposal | null> {
  let price = 0
  try {
    const res = await fetch('https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    price = Number((await res.json() as any)?.price || 0)
  } catch { return null }
  if (!price || !Number.isFinite(price)) return null

  const lastRaw = await kvGetKey(cfg, 'mkt:xau:last_price')
  await kvSetKey(cfg, 'mkt:xau:last_price', String(price)) // simpan selalu → Δ diukur antar sweep
  const last = Number(lastRaw || 0)
  if (!last || !Number.isFinite(last)) return null // sweep pertama: baseline saja

  const changePct = ((price - last) / last) * 100
  if (Math.abs(changePct) < 0.8) return null // hanya gerakan bermakna

  const arah = changePct < 0 ? 'DROP' : 'PUMP'
  const dataRiil = `DATA RIIL: XAUUSD ${arah} dari ${last.toFixed(2)} ke ${price.toFixed(2)} (Δ ${changePct.toFixed(2)}%) — sumber api.gold-api.com, ${new Date().toISOString()}`
  const j = await orJson(
    `Kamu SINTA (CMO LuxTradee — aplikasi jurnal trading AI). Tugasmu mendeteksi momen market dan menyiapkan konten. ${ANTI_HALUSINASI} Format output: {"laporan":"1-2 kalimat untuk CEO","proposed_action":{"platform":"ig","title":"...","content_body":"..."}}. content_body = caption IG siap posting (maks 500 karakter, bahasa Indonesia santil, ada CTA jurnal trading LuxTradee).`,
    `${dataRiil}\nBuat konten ${arah === 'DROP' ? 'menangkap peluang momentum turun (edukasi risiko + peluang)' : 'mengingatkan disiplin saat harga naik (FOMO control)'}.`,
    'google/gemma-4-31b-it:free',
    'Sinta',
    800,
    cfg,
  )
  const action = j?.proposed_action || {}
  const payload = {
    platform: String(action.platform || 'ig'),
    title: String(action.title || `XAUUSD ${arah} ${changePct.toFixed(2)}% — momen untuk trader disiplin`),
    content_body: String(action.content_body || `Harga emas (XAUUSD) baru saja ${arah === 'DROP' ? 'turun' : 'naik'} ${Math.abs(changePct).toFixed(2)}% ke ${price.toFixed(2)}. Momen seperti ini paling cepat membakar akun kalau tanpa catatan. Yuk mulai jurnal trading otomatis di LuxTradee — 2 menit dari screenshot.`),
    media_url: '',
    market_snapshot: { from: last, to: price, change_pct: Number(changePct.toFixed(3)), source: 'api.gold-api.com' },
    ai_source: j?.ai_model ? `llm:${j.ai_model}` : 'template',
    ...(j?.ai_error ? { ai_error: String(j.ai_error).slice(0, 200) } : {}),
  }
  return { agentName: 'Sinta', actionType: 'PUBLISH_CONTENT', payload }
}

/* ---------- MAYA (CSO): user aktif tidak login 3 hari → winback ---------- */
export async function mayaWinbackProposal(cfg: SbConfig): Promise<DetectedProposal | null> {
  const trades = await sbSelect(cfg, 'trades', `select=user_id&created_at=gte.${isoAgo(24 * 7)}&limit=1000`)
  if (!trades.ok) return null
  const activeIds = [...new Set(trades.rows.map((r: any) => String(r.user_id)).filter(Boolean))].slice(0, 500)
  if (activeIds.length === 0) return null

  const prof = await sbSelect(cfg, 'profiles', `select=id,email,last_sign_in_at,is_pro&id=in.(${activeIds.join(',')})&limit=500`)
  if (!prof.ok) return null
  const cutoff = isoAgo(24 * 3)
  const candidates = prof.rows
    .filter((p: any) => p.email && String(p.last_sign_in_at || '') < cutoff)

  /* 🔗 UNIFIKASI COOLDOWN MAYA (penutup temuan "dobel karyawan" — arah sama
     dgn unifikasi Bagas): kandidat yang baru di-winback 14 hari terakhir
     (KV `winback:{email}`, semantik SAMA dgn agentMaya di master-autonomous)
     atau baru masuk antrean Bagas 7 hari terakhir TIDAK diusulkan lagi.
     Fail-open: kalau query gagal (tabel/KV belum ada) → set kosong →
     perilaku lama. Nol migrasi baru. */
  const WB_TTL_MS = 14 * 24 * 3600_000
  const nowMs = Date.now()
  const wbRecent = new Set<string>()
  try {
    const wb = await sbSelect(cfg, 'agent_kv', `select=key,value&key=like.winback.*&limit=500`)
    if (wb.ok) {
      for (const row of wb.rows as Array<{ key: string; value: string }>) {
        const ts = new Date(row.value || '').getTime()
        if (Number.isFinite(ts) && nowMs - ts < WB_TTL_MS) wbRecent.add(String(row.key).toLowerCase())
      }
    }
  } catch { /* fail-open */ }
  const bagasRecent = new Set<string>()
  try {
    const sinceCd = bagasCooldownSince()
    const [tasksCd, actionsCd] = await Promise.all([
      sbSelect(cfg, 'ai_pending_tasks', `select=target_user_id,context_data&agent_type=eq.COO&${bagasCooldownOrFilter(sinceCd)}&limit=200`),
      sbSelect(cfg, 'ai_pending_actions', `select=action_payload&agent_name=eq.Bagas&${bagasCooldownOrFilter(sinceCd)}&limit=200`),
    ])
    if (tasksCd.ok) {
      for (const e of contactsFromTaskRows(tasksCd.rows).emails) bagasRecent.add(e)
    }
    if (actionsCd.ok) {
      for (const e of emailsFromActionRows(actionsCd.rows)) bagasRecent.add(e)
    }
  } catch { /* fail-open */ }

  const targets = candidates
    .filter((p: any) => {
      const em = String(p.email).toLowerCase()
      if (wbRecent.has(`winback:${em}`)) return false // baru di-winback 14 hari
      if (bagasRecent.has(em)) return false // baru ditawarin PRO sama Bagas 7 hari
      return true
    })
    .slice(0, 30)
  if (targets.length === 0) return null

  const discount = (await kvGetKey(cfg, 'maya:discount_code')) || ''
  const dataRiil = `DATA RIIL: ${targets.length} user aktif (upload trade 7 hari terakhir) terdeteksi TIDAK LOGIN ≥3 hari. Kredensial: PRO akun ${discount ? 'tersedia' : 'belum ada kode diskon (jangan sebut diskon)'}.`
  const j = await orJson(
    `Kamu MAYA (CSO LuxTradee). Buat email winback yang hangat, tidak nagih, fokus manfaat. ${ANTI_HALUSINASI} Format: {"laporan":"...","proposed_action":{"subject":"...","html_body":"..."}}. html_body = HTML sederhana (p, b, br) siap kirim.`,
    `${dataRiil}\nBuat 1 subjek + 1 body email winback. ${discount ? `Sebut kode diskon: ${discount}.` : 'JANGAN menyebut diskon/kode apapun.'}`,
    'google/gemma-4-26b-a4b-it:free',
    'Maya',
    800,
    cfg,
  )
  const action = j?.proposed_action || {}
  const subject = String(action.subject || 'Kangen lihat jurnalmu kosong — balik yuk?')
  const htmlBody = String(action.html_body || `<p>Halo trader,</p><p>Kami lihat kamu aktif trading minggu ini tapi belum login 3 hari terakhir. Jurnal yang kosong itu kehilangan data — trade bagus hari ini bisa jadi pelajaran besok.</p><p>Upload 1 screenshot, AI LuxTradee evaluasi dalam 2 menit: <b>https://luxtradee.web.id</b></p>`)
  // Catat cooldown winback SEKARANG (semantik master-autonomous: KV di-set
  // saat proposal dibuat) → sweep berikutnya 14 hari tidak mengusulkan
  // email yang sama, meskipun dedup 24 jam insertPendingAction sudah lolos.
  for (const t of targets as Array<{ email: string }>) {
    try { await kvSetKey(cfg, `winback:${String(t.email).toLowerCase()}`, new Date().toISOString()) } catch { /* opsional */ }
  }
  return {
    agentName: 'Maya',
    actionType: 'SEND_WINBACK_EMAIL',
    payload: { target_emails: targets.map((t: any) => String(t.email)), subject, html_body: htmlBody, discount_code: discount, target_count: targets.length, ai_source: j?.ai_model ? `llm:${j.ai_model}` : 'template', ...(j?.ai_error ? { ai_error: String(j.ai_error).slice(0, 200) } : {}) },
  }
}

/* ---------- FARHAN (GH): konversi landing rendah (analisis mingguan) ---------- */
export async function farhanABProposal(cfg: SbConfig): Promise<DetectedProposal | null> {
  const cur = await sbCountExact(cfg, 'profiles', `created_at=gte.${isoAgo(24 * 7)}`)
  const prev = await sbCountExact(cfg, 'profiles', `created_at=gte.${isoAgo(24 * 14)}&created_at=lt.${isoAgo(24 * 7)}`)
  if (cur < 0 || prev < 0) return null
  if (prev < 5 || cur >= Math.ceil(prev * 0.5)) return null // hanya drop drastis yang jadi proposal
  const total = await sbCountExact(cfg, 'profiles', '')
  const variant = `Bergabung dengan ${Math.max(total, cur)} trader — jurnal trading otomatis dari screenshot, 2 menit selesai.`
  const payload = {
    component: 'hero_cta',
    new_text_variant: variant,
    traffic_split: '50/50',
    analysis: { signups_7d: cur, signups_prev_7d: prev, drop_pct: prev > 0 ? Number((((prev - cur) / prev) * 100).toFixed(1)) : 0 },
  }
  return { agentName: 'Farhan', actionType: 'UPDATE_AB_TEST', payload, dedupMinutes: 24 * 7 }
}

/* ---------- BAGAS (COO): free user paling aktif minggu ini (Hot Leads) ---------- */
export async function bagasHotLeadsProposal(cfg: SbConfig): Promise<DetectedProposal | null> {
  const trades = await sbSelect(cfg, 'trades', `select=user_id&created_at=gte.${isoAgo(24 * 7)}&limit=1000`)
  if (!trades.ok) return null
  const counts = new Map<string, number>()
  for (const r of trades.rows as any[]) {
    const id = String(r.user_id || '')
    if (id) counts.set(id, (counts.get(id) || 0) + 1)
  }
  /* Ambil 10 kandidat teratas (bukan langsung 3) — setelah filter cooldown
     lintas antrean di bawah, sisa yang layak baru dipotong jadi maks 3. */
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  if (top.length === 0 || top[0][1] < 3) return null // butuh ≥3 trade minggu ini biar bener2 "hot"

  const prof = await sbSelect(cfg, 'profiles', `select=id,email,is_pro&id=in.(${top.map(t => t[0]).join(',')})&limit=10`)
  if (!prof.ok) return null
  const hot = top
    .map(([id, n]) => ({ id, trades: n, prof: (prof.rows as any[]).find(p => String(p.id) === id) }))
    .filter(h => h.prof?.email && !h.prof?.is_pro)
  if (hot.length === 0) return null

  /* 🔗 UNIFIKASI COOLDOWN (penutup temuan "DOBEL BAGAS"): lead yang baru
     didraft cron COO harian di ai_pending_tasks (agent_type='COO', window
     7 hari — sama dgn jalur sebaliknya, ikut executed_at utk ACC telat)
     TIDAK diusulkan ulang di sini. Fail-open: tabel belum ada (migrasi 011)
     → set kosong → perilaku lama. */
  const sinceCd = bagasCooldownSince()
  const tasksCd = await sbSelect(
    cfg,
    'ai_pending_tasks',
    `select=target_user_id,context_data&agent_type=eq.COO&${bagasCooldownOrFilter(sinceCd)}&limit=120`,
  )
  const cross = tasksCd.ok
    ? contactsFromTaskRows(tasksCd.rows)
    : { emails: new Set<string>(), userIds: new Set<string>() }
  const eligible = hot
    .filter(h => !cross.userIds.has(h.id) && !cross.emails.has(String(h.prof?.email || '').toLowerCase()))
    .slice(0, 3)
  if (eligible.length === 0) return null

  const dataRiil = `DATA RIIL: ${eligible.length} free user paling aktif 7 hari: ${eligible.map(h => `${h.trades} trade`).join(', ')}. Ini Hot Leads — paling mungkin upgrade PRO.`
  const j = await orJson(
    `Kamu BAGAS (COO LuxTradee). Buat penawaran upgrade PRO yang personal & tidak maksa. ${ANTI_HALUSINASI} Format: {"laporan":"...","proposed_action":{"target_emails":["..."],"personalized_message":"..."}}. Salin email persis dari data (JANGAN mengarang email).`,
    `${dataRiil}\nEmail targets: ${eligible.map(h => String(h.prof.email)).join(', ')}. Buat 1 personalized_message (maks 120 kata) yang menyebut aktivitas mereka secara umum (sering upload jurnal minggu ini) + manfaat PRO (evaluasi AI tanpa batas).`,
    'nvidia/nemotron-3.5-lightning:free',
    'Bagas',
    800,
    cfg,
  )
  const action = j?.proposed_action || {}
  const message = String(action.personalized_message || `Halo trader aktif! 👋 Minggu ini kamu salah satu yang paling rajin upload jurnal di LuxTradee. Versi PRO membuka evaluasi AI tanpa batas + laporan mendalam — pas banget buat ritme trading kamu. Cek: https://luxtradee.web.id`)
  return {
    agentName: 'Bagas',
    actionType: 'SEND_UPGRADE_OFFER',
    payload: { target_emails: eligible.map(h => String(h.prof.email)), personalized_message: message, hot_stats: eligible.map(h => ({ trades: h.trades })), ai_source: j?.ai_model ? `llm:${j.ai_model}` : 'template', ...(j?.ai_error ? { ai_error: String(j.ai_error).slice(0, 200) } : {}) },
  }
}

/* ---------- RAKA (CTO): situs down/error → broadcast maintenance ---------- */
export async function rakaMaintenanceProposal(cfg: SbConfig, siteOverride?: { siteOk: boolean; status: number; err: string }): Promise<DetectedProposal | null> {
  let site = siteOverride || null
  if (!site) {
    const ping = async (): Promise<{ siteOk: boolean; status: number; err: string }> => {
      try {
        const t0 = Date.now()
        const res = await fetch('https://luxtradee.web.id', { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15_000) })
        return { siteOk: res.ok, status: res.status, err: '' }
      } catch (x: any) { return { siteOk: false, status: 0, err: String(x?.message || x) } }
    }
    site = await ping()
    if (!site.siteOk) {
      await new Promise(r => setTimeout(r, 1500))
      const retry = await ping()
      if (retry.siteOk || !site.err) site = retry
    }
    // 521-524 = false negative self-ping Cloudflare (pola ctoAgent) → anggap hidup
    if (!site.siteOk && [521, 522, 523, 524].includes(site.status)) site = { siteOk: true, status: site.status, err: `${site.status} (self-ping CF diabaikan)` }
  }
  if (site.siteOk) return null
  const payload = {
    urgent: true,
    email_body: `Server LuxTradee sedang perbaikan. Status terdeteksi: ${site.status || 'timeout'}${site.err ? ` (${String(site.err).slice(0, 120)})` : ''}. Tim teknis sedang menangani — data trading kamu aman. Mohon coba lagi beberapa saat lagi.`,
    detected_status: site.status,
  }
  return { agentName: 'Raka', actionType: 'BROADCAST_MAINTENANCE', payload, dedupMinutes: 6 * 60 }
}

/* ---------- DEWI (DA): pola fatal — banyak loss di sesi London ---------- */
export async function dewiPatternProposal(cfg: SbConfig): Promise<DetectedProposal | null> {
  const trades = await sbSelect(cfg, 'trades', `select=close_time,profit_loss&created_at=gte.${isoAgo(24 * 7)}&limit=1000`)
  if (!trades.ok) return null
  let london = 0, londonLoss = 0
  for (const t of trades.rows as any[]) {
    const ct = t.close_time ? new Date(t.close_time) : null
    if (!ct || Number.isNaN(ct.getTime())) continue
    const h = ct.getUTCHours()
    if (h >= 7 && h < 16) { // sesi London (UTC)
      london++
      if (Number(t.profit_loss || 0) < 0) londonLoss++
    }
  }
  if (london < 10) return null // sampel kecil → bukan pola
  const lossPct = (londonLoss / london) * 100
  if (lossPct < 70) return null
  const payload = {
    assign_to: 'Sinta',
    task_instruction: `Buat peringatan bahaya sesi London: ${londonLoss}/${london} trade komunitas di sesi London rugi (${lossPct.toFixed(0)}%) dalam 7 hari terakhir. Prioritas konten edukasi manajemen risiko jam London (overtrading & spread lebar).`,
    pattern: { session: 'London', trades: london, losses: londonLoss, loss_pct: Number(lossPct.toFixed(1)) },
  }
  return { agentName: 'Dewi', actionType: 'TRIGGER_INTERNAL_TASK', payload }
}

/* ---------- PUTRI (CFO — 100% hardcoded, tanpa LLM): kuota API ≥95% ---------- */
export async function putriQuotaProposal(cfg: SbConfig): Promise<DetectedProposal | null> {
  const gem429 = parseInt((await kvGetKey(cfg, `quota429:${wibDay()}`)) || '0', 10)
  const resend = parseInt((await kvGetKey(cfg, `resend_sent:${wibDay()}`)) || '0', 10)
  const alreadyOff = (await kvGetKey(cfg, 'feature:auto_journal:disabled')) === '1'
  if (alreadyOff) return null
  // Ambang: Gemini free ≈ 429 bertubi = kuota generik habis; Resend free = 100 email/hari → 90 = 90%
  if (gem429 < 15 && resend < 90) return null
  const payload = {
    feature: 'auto_journal',
    action: 'disable',
    reason: 'quota_limit',
    evidence: { gemini_429_today: gem429, resend_sent_today: resend, threshold: { gemini_429: 15, resend: 90 } },
  }
  return { agentName: 'Putri', actionType: 'TOGGLE_FREE_FEATURES', payload, dedupMinutes: 12 * 60 }
}

/* ================= SWEEP — jalankan semua detektor ================= */

export interface SweepStep { agent: string; actionType: string; triggered: boolean; inserted?: boolean; note?: string }

/**
 * Jalankan seluruh detektor (dipanggil cron tiap 15 menit via
 * /api/agent-proposals?run=sweep, atau manual oleh CEO).
 * Tiap langkah di-guard — satu agen gagal tidak menjatuhkan lainnya.
 */
export async function runProposalSweep(cfg: SbConfig, opts?: { includeRaka?: boolean }): Promise<{ ok: boolean; steps: SweepStep[]; created: number }> {
  const steps: SweepStep[] = []
  const detectors: Array<{ agent: string; type: string; fn: () => Promise<DetectedProposal | null> }> = [
    { agent: 'Sinta', type: 'PUBLISH_CONTENT', fn: () => sintaMarketProposal(cfg) },
    { agent: 'Maya', type: 'SEND_WINBACK_EMAIL', fn: () => mayaWinbackProposal(cfg) },
    { agent: 'Farhan', type: 'UPDATE_AB_TEST', fn: () => farhanABProposal(cfg) },
    { agent: 'Bagas', type: 'SEND_UPGRADE_OFFER', fn: () => bagasHotLeadsProposal(cfg) },
    { agent: 'Dewi', type: 'TRIGGER_INTERNAL_TASK', fn: () => dewiPatternProposal(cfg) },
    { agent: 'Putri', type: 'TOGGLE_FREE_FEATURES', fn: () => putriQuotaProposal(cfg) },
  ]
  if (opts?.includeRaka !== false) {
    detectors.push({ agent: 'Raka', type: 'BROADCAST_MAINTENANCE', fn: () => rakaMaintenanceProposal(cfg) })
  }

  let created = 0
  for (const d of detectors) {
    try {
      const p = await d.fn()
      if (!p) {
        steps.push({ agent: d.agent, actionType: d.type, triggered: false, note: 'tidak ada trigger' })
        continue
      }
      const ins = await insertPendingAction(cfg, { agentName: p.agentName, actionType: p.actionType, payload: p.payload, dedupMinutes: p.dedupMinutes })
      if (ins.inserted) created++
      steps.push({ agent: d.agent, actionType: d.type, triggered: true, inserted: ins.inserted, note: ins.reason || (ins.id ? `id=${ins.id}` : '') })
    } catch (x: any) {
      steps.push({ agent: d.agent, actionType: d.type, triggered: false, note: `error: ${String(x?.message || x).slice(0, 140)}` })
    }
  }
  return { ok: true, steps, created }
}
