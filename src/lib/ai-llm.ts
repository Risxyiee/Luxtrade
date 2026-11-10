import { getEnvVar } from '@/lib/cloudflare-bindings'
import { kvGet, kvSet } from '@/lib/kv-cache'

/**
 * Shared LLM helper untuk AI Staff agents — Cloudflare Workers safe.
 *
 * Menggunakan raw fetch (bukan SDK) karena beberapa SDK AI memakai
 * fs/node API yang tidak tersedia di CF Workers runtime.
 *
 * ═══════════════════════════════════════════════════════════════════
 * RANTAI PROVIDER SELF-HEALING + AUTO-DISCOVER (permintaan Bos):
 * "perbaiki api yang limit — karyawan ai ganti ke yang baru dan free,
 *  harus pintar berpikir & menemukan solusi sendiri"
 *
 *   Mortera (deposit Rupiah, prioritas 1) → Groq (free) → Gemini (free)
 *   → OpenRouter (:free) → null
 *
 * Mortera Cloud (mortera.cloud) = gateway OpenAI-compatible billing Rupiah.
 * AKTIF hanya kalau MORTERA_API_KEY diset (CF secret / env) — tanpa key,
 * provider ini dilompati dan rantai berperilaku persis seperti dulu.
 * Saldo habis (HTTP 402) → cooldown 60 mnt → otomatis jatuh ke rantai
 * free: karyawan TIDAK PERNAH mogok hanya karena lupa top-up.
 *
 * Lapis pertahanan (dari luar ke dalam):
 *   1. PROVIDER rotasi: 429/limit → provider didinginkan (10 mnt),
 *      call berikutnya langsung lompat; 401/403 → cooldown 60 mnt.
 *   2. MODEL fallback: 404/400 (model dimatikan) → coba model
 *      cadangan hardcoded di provider yang sama.
 *   3. AUTO-DISCOVER: semua model hardcoded mati? → tanya daftar model
 *      LANGSUNG ke provider (GET /models), pilih yang masih hidup &
 *      cocok (prefer flash/70b, OpenRouter WAJIB ':free' — nol biaya),
 *      cache 6 jam. Provider pulih sendiri tanpa deploy ulang.
 *   4. Gemini 5xx (overload) → retry model cadangan, bukan menyerah.
 *
 * Semua keputusan dicatat di notes (getLastLLMDiag) → ditulis Sinta ke
 * office_memory → run berikutnya "tahu" apa yang terjadi.
 * Override model via env MORTERA_MODEL / GROQ_MODEL / GEMINI_MODEL / OPENROUTER_MODEL.
 * ═══════════════════════════════════════════════════════════════════
 */

export interface LLMResult {
  text: string
  provider: 'mortera' | 'groq' | 'gemini' | 'openrouter'
  model: string
  /** Catatan rotasi/fallback/discover yang terjadi (untuk office_memory). */
  notes?: string[]
}

/** Satu giliran bicara untuk panggilan KONVERSASI (multi-turn, mis. CS bot
 *  dengan riwayat chat). 'assistant' = jawaban AI sebelumnya. */
export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Input user prompt: string biasa (pola lama, semua caller existing)
 *  ATAU array giliran percakapan (pola baru — riwayat chat utuh). */
export type LLMUserInput = string | ConversationTurn[]

function toTurns(u: LLMUserInput): ConversationTurn[] {
  if (typeof u === 'string') return [{ role: 'user', content: u }]
  return (Array.isArray(u) ? u : [])
    .filter((t) => t && typeof t.content === 'string' && t.content.trim())
    .map((t) => ({ role: t.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: t.content }))
}

/** Konversi turns → `contents` Gemini: role 'model' utk assistant, gabung
 *  turn berurutan se-role (Gemini rewel), konten pertama WAJIB 'user'. */
function toGeminiContents(u: LLMUserInput): Array<{ role: 'user' | 'model'; parts: { text: string }[] }> {
  const merged: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = []
  for (const t of toTurns(u)) {
    const role = t.role === 'assistant' ? ('model' as const) : ('user' as const)
    const last = merged[merged.length - 1]
    if (last && last.role === role) last.parts[0].text += '\n\n' + t.content
    else merged.push({ role, parts: [{ text: t.content }] })
  }
  if (!merged.length || merged[0].role === 'model') {
    merged.unshift({ role: 'user', parts: [{ text: '(lanjutkan percakapan)' }] })
  }
  return merged
}

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
/* Mortera Cloud — kuda beban prioritas (deposit Rupiah Bos). Default:
   Claude SONNET 5.5 (Rp 2.955/14.775 per 1M — otak premium) → Claude Haiku
   5.5 (Rp 394/1.182, cadangan murah) → GPT-6.1 Terra (Rp 985/4.925).
   PERMINTAAN BOS 10 Nov 2026: "ganti api ke sonnet semua" — SEMUA karyawan
   kantor AI (CEO Alexander, Sinta, Bagas, Maya, Raka, Putri, Farhan, Kevin,
   CS bot, growth cron) kini berotak Claude Sonnet 5.5. Fable/Opus SENGAJA
   di-veto (Rp 10rb-55rb input per 1M — tidak ada tugas karyawan yang butuh).
   FIX 2026-11-08 (diag produksi /api/health): katalog asli Mortera memakai
   DASH bukan TITIK — 'claude-sonnet-5-5' hidup (kena 429 = namanya ADA),
   'claude-sonnet-5.5' selalu 404. Nama salah = 2× round-trip 404 sia-sia
   sebelum auto-discover menemukan nama yang benar → sekarang langsung benar. */
const MORTERA_MODEL = process.env.MORTERA_MODEL || 'claude-sonnet-5-5'
const MORTERA_FALLBACKS = ['claude-haiku-5-5', 'gpt-6.1-terra']
/** Model cadangan kalau model utama sudah dimatikan provider (HTTP 404/400). */
const GROQ_FALLBACKS = ['llama-3.1-8b-instant']
const GEMINI_FALLBACKS = ['gemini-flash-latest', 'gemini-2.5-flash']
const OPENROUTER_FALLBACKS = ['deepseek/deepseek-chat-v3-0324:free', 'google/gemini-2.5-flash:free']

/* ── Cooldown antar-panggilan (per isolate Workers) ─────────────── */
const COOLDOWN_MS_LIMIT = 10 * 60 * 1000
const COOLDOWN_MS_AUTH = 60 * 60 * 1000
/* FIX OTAK ALEXANDER (keluhan Bos 10 Nov: "otak ceo karyawan ai templat
   mulu padahal udah make api berbayar"): dulu TIMEOUT → cooldown 5 MENIT
   ditulis ke KV lintas-isolate. Akibatnya SATU hang Mortera di awal briefing
   (08:00 WIB) memvakumkan API BERBAYAR untuk SEMUA karyawan selama 5 menit
   penuh — justru di jendela paling penting — lalu rantai free yang lambat/
   429 yang ambil alih → briefing jatuh templat. Timeout = gangguan SEMENTARA
   (gateway ngantuk), bukan mati permanen seperti 401/402 → kini cuma 90 dtk:
   panggilan karyawan berikutnya (fase 2 briefing, watchdog 15 mnt) langsung
   mencoba Mortera lagi. */
const COOLDOWN_MS_TIMEOUT = 90 * 1000
const providerCoolUntil = new Map<string, number>()

/* FIX CS LAMBAT (laporan Bos 8 Nov 2026: "landing page cs respond lama
   sm cs didashbord"): cooldown dulu CUMA in-memory per-isolate — isolate
   CF Workers baru = map kosong = provider yang barusan menggantung 40
   dtk dicoba LAGI dari awal di pesan berikutnya. Kini cooldown
   dicerminkan ke KV (lintas-isolate, TTL 1 jam): isolate mana pun yang
   melayani chat langsung tahu provider mana yang sedang sakit. */
const COOL_KV_KEY = 'llm-provider-cooldown'
const COOL_KV_TTL_SEC = 60 * 60 // 1 jam — meliputi cooldown terpanjang (auth 60 mnt)

/** Sinkronkan cooldown dari KV → memori isolate ini (sekali per callLLM). */
async function hydrateCooldowns(): Promise<void> {
  const saved = await kvGet<Record<string, number>>(COOL_KV_KEY)
  if (!saved) return
  for (const [provider, until] of Object.entries(saved)) {
    if (until > Date.now() && (providerCoolUntil.get(provider) || 0) < until) {
      providerCoolUntil.set(provider, until)
    }
  }
}

/** Cerminakan cooldown provider ke KV (lintas-isolate). Gagal = diam —
    pendinginkan memori tetap jalan (best-effort). */
async function persistCooldown(provider: string, until: number): Promise<void> {
  const saved = (await kvGet<Record<string, number>>(COOL_KV_KEY)) || {}
  saved[provider] = Math.max(saved[provider] || 0, until)
  // Buang entri kedaluwarsa biar map tetap ramping
  const now = Date.now()
  for (const k of Object.keys(saved)) {
    if ((saved[k] || 0) <= now) delete saved[k]
  }
  await kvSet(COOL_KV_KEY, saved, { ttl: COOL_KV_TTL_SEC })
}

function isCool(provider: string): boolean {
  const until = providerCoolUntil.get(provider) || 0
  return Date.now() < until
}
async function cool(provider: string, ms: number): Promise<void> {
  const until = Date.now() + ms
  providerCoolUntil.set(provider, until)
  try { await persistCooldown(provider, until) } catch { /* best-effort */ }
}
function coolReason(provider: string): string {
  const until = providerCoolUntil.get(provider) || 0
  const min = Math.max(1, Math.round((until - Date.now()) / 60_000))
  return `${provider} didinginkan ${min} menit lagi`
}

/* ── AUTO-DISCOVER model hidup (cache 6 jam per provider) ──────────
   Semua model hardcoded 404? Tanya provider langsung via GET /models,
   pilih kandidat terbaik yang masih tersedia. Ini yang bikin rantai
   "menemukan solusi sendiri" — tanpa deploy ulang. */
const DISCOVER_TTL = 6 * 60 * 60 * 1000
/** Cache kekosongan hasil discover — 30 mnt (anti badai subrequest). */
const DISCOVER_FAIL_TTL = 30 * 60 * 1000
const discovered = new Map<string, { models: string[]; until: number }>()

async function discoverOpenAIModels(
  label: 'mortera' | 'groq' | 'openrouter',
  baseUrl: string,
  apiKey: string,
  score: (id: string) => number,
): Promise<string[]> {
  const hit = discovered.get(label)
  if (hit && Date.now() < hit.until) return hit.models
  /* DISCOVER_FAIL_TTL: hasil KOSONG juga di-cache (30 mnt) — dulu tiap
     panggilan mengulang GET /models padahal kandidat memang tak ada,
     jadi pemborosan subrequest beruntun (insiden master-autonomous
     8 Nov: 5 agen × rantai mati = limit 50 subrequest/invokasi tembus,
     semua fetch ikut jebol "Too many subrequests"). */
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) { discovered.set(label, { models: [], until: Date.now() + DISCOVER_FAIL_TTL }); return [] }
    const data = await res.json() as { data?: { id?: string }[] }
    const ids = (data?.data || []).map((m) => String(m?.id || '')).filter(Boolean)
    if (!ids.length) { discovered.set(label, { models: [], until: Date.now() + DISCOVER_FAIL_TTL }); return [] }
    const ranked = [...ids].sort((a, b) => score(b) - score(a)).filter((id) => score(id) > 0).slice(0, 3)
    if (!ranked.length) { discovered.set(label, { models: [], until: Date.now() + DISCOVER_FAIL_TTL }); return [] }
    discovered.set(label, { models: ranked, until: Date.now() + DISCOVER_TTL })
    return ranked
  } catch { return [] }
}

async function discoverGeminiModels(apiKey: string): Promise<string[]> {
  const hit = discovered.get('gemini')
  if (hit && Date.now() < hit.until) return hit.models
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
      { signal: AbortSignal.timeout(12_000) },
    )
    if (!res.ok) { discovered.set('gemini', { models: [], until: Date.now() + DISCOVER_FAIL_TTL }); return [] }
    const data = await res.json() as { models?: { name?: string; supportedGenerationMethods?: string[] }[] }
    const usable = (data?.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((id) => id && !/embedding|aqa|image|audio|tts|veo/i.test(id))
    if (!usable.length) { discovered.set('gemini', { models: [], until: Date.now() + DISCOVER_FAIL_TTL }); return [] }
    const score = (id: string) =>
      (/flash/i.test(id) ? 40 : 0) + (/gemini/i.test(id) ? 20 : 0) + (/latest/i.test(id) ? 5 : 0) - (/thinking|pro/i.test(id) ? 8 : 0)
    const ranked = [...usable].sort((a, b) => score(b) - score(a)).slice(0, 3)
    discovered.set('gemini', { models: ranked, until: Date.now() + DISCOVER_TTL })
    return ranked
  } catch { return [] }
}

/** Skor kandidat Groq: prefer chat LLM besar; penalti keras model non-chat. */
const groqScore = (id: string) => {
  if (/whisper|tts|guard|distil|embed|vision-preview|playai/i.test(id)) return -100
  return (/120b/i.test(id) ? 45 : 0) + (/70b/i.test(id) ? 40 : 0) + (/32b|27b/i.test(id) ? 18 : 0) + (/llama/i.test(id) ? 20 : 0) + (/gpt-oss/i.test(id) ? 16 : 0) + (/qwen/i.test(id) ? 12 : 0) + (/kimi|moonshot/i.test(id) ? 10 : 0) - (/8b|20b|1b|3b/i.test(id) ? 6 : 0)
}
/** Skor kandidat OpenRouter: WAJIB ':free' (Bos: nol biaya). */
const openrouterScore = (id: string) => {
  if (!id.endsWith(':free')) return -100
  return (/llama-3\.3-70b/i.test(id) ? 30 : 0) + (/deepseek-chat|deepseek-v3/i.test(id) ? 25 : 0) + (/qwen/i.test(id) ? 14 : 0) + (/llama/i.test(id) ? 10 : 0) + (/gemini-flash/i.test(id) ? 14 : 0) - (/exp|preview|deprecated/i.test(id) ? 12 : 0)
}

async function getGroqKey(): Promise<string> {
  try { return (await getEnvVar('GROQ_API_KEY', { quiet: true })) || process.env.GROQ_API_KEY || '' } catch { return process.env.GROQ_API_KEY || '' }
}
async function getGeminiKey(): Promise<string> {
  try { return (await getEnvVar('GEMINI_API_KEY', { quiet: true })) || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '' } catch { return process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '' }
}
async function getOpenRouterKey(): Promise<string> {
  try { return (await getEnvVar('OPENROUTER_API_KEY', { quiet: true })) || process.env.OPENROUTER_API_KEY || '' } catch { return process.env.OPENROUTER_API_KEY || '' }
}
async function getMorteraKey(): Promise<string> {
  try { return (await getEnvVar('MORTERA_API_KEY', { quiet: true })) || process.env.MORTERA_API_KEY || '' } catch { return process.env.MORTERA_API_KEY || '' }
}

/** Cek ketersediaan LLM tanpa melakukan panggilan (untuk logging & response meta). */
export async function getLLMProviderName(): Promise<'mortera' | 'groq' | 'gemini' | 'openrouter' | 'template'> {
  if (await getMorteraKey()) return 'mortera'
  if (await getGroqKey()) return 'groq'
  if (await getGeminiKey()) return 'gemini'
  if (await getOpenRouterKey()) return 'openrouter'
  return 'template'
}

/** Status rantai provider — untuk diagnostik (route GET / log admin). */
export async function getLLMChainStatus(): Promise<{ provider: string; ok: boolean; reason?: string }[]> {
  const out: { provider: string; ok: boolean; reason?: string }[] = []
  const mor = await getMorteraKey()
  out.push({ provider: `mortera(${MORTERA_MODEL})`, ok: !!mor && !isCool('mortera'), reason: !mor ? 'no key' : isCool('mortera') ? coolReason('mortera') : undefined })
  const groq = await getGroqKey()
  out.push({ provider: `groq(${GROQ_MODEL})`, ok: !!groq && !isCool('groq'), reason: !groq ? 'no key' : isCool('groq') ? coolReason('groq') : undefined })
  const gem = await getGeminiKey()
  out.push({ provider: `gemini(${GEMINI_MODEL})`, ok: !!gem && !isCool('gemini'), reason: !gem ? 'no key' : isCool('gemini') ? coolReason('gemini') : undefined })
  const or = await getOpenRouterKey()
  out.push({ provider: `openrouter(${OPENROUTER_MODEL})`, ok: !!or && !isCool('openrouter'), reason: !or ? 'no key' : isCool('openrouter') ? coolReason('openrouter') : undefined })
  return out
}

/** Diagnosa rotasi dari callLLM TERAKHIR (termasuk saat gagal total). */
let lastCallDiag: string[] = []
export function getLastLLMDiag(): string[] { return lastCallDiag }

/* ── CEK SALDO MORTERA (tampilkannya di /api/health) ───────────────
   Keluhan Bos 8 Nov: "udah saya isi saldo kok masih error?" — pesan
   429 Mortera = "wallet cannot cover this request's maximum cost".
   Dokumen resmi Mortera: key punya billing_modes (payg = Rupiah /
   token = paket kredit); request ditolak bila wallet yang DIIZINKAN
   KEY tidak menutup estimasi input + min 1 token output — WALAU
   saldo jenis lain ada. GET /v1/credits melaporkan saldo key ini,
   GET /v1/key melaporkan label + billing_modes + tier. Hasilnya
   bikin Bos lihat SENDIRI: saldo kosong? salah jenis wallet? key
   salah akun? — tanpa buka log, tanpa nilai key bocor. */
export interface MorteraWalletStatus {
  reachable: boolean
  /** Saldo Pay As You Go (IDR) milik key ini — null bila tidak dilaporkan. */
  paygIdr?: number
  /** Sisa kredit paket Token milik key ini. */
  tokenCredits?: number
  /** Mode billing yang diizinkan utk key ini (payg/token). */
  billingModes?: string[]
  label?: string
  tier?: string
  error?: string
}
let morteraWalletCache: { at: number; val: MorteraWalletStatus } | null = null
export async function getMorteraWallet(): Promise<MorteraWalletStatus | null> {
  if (morteraWalletCache && Date.now() - morteraWalletCache.at < 60_000) return morteraWalletCache.val
  const key = await getMorteraKey()
  if (!key) return null
  const val = await (async (): Promise<MorteraWalletStatus> => {
    try {
      const res = await fetch('https://mortera.cloud/v1/credits', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) return { reachable: false, error: `GET /v1/credits → HTTP ${res.status}` }
      const body = await res.json().catch(() => null) as Record<string, unknown> | null
      const data = (body?.data ?? body ?? {}) as Record<string, unknown>
      const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
      const status: MorteraWalletStatus = {
        reachable: true,
        paygIdr: num(data.payg_idr) ?? num(data.payg) ?? num(data.balance_idr) ?? num(data.idr),
        tokenCredits: num(data.credits) ?? num(data.token_credits) ?? num(data.credits_remaining),
      }
      // Bentuk tak dikenal → teruskan mentah biar tetap kelihatan isinya.
      if (status.paygIdr === undefined && status.tokenCredits === undefined) {
        status.error = `bentuk tak dikenal: ${JSON.stringify(body).slice(0, 200)}`
      }
      return status
    } catch (err) {
      return { reachable: false, error: String((err as Error)?.message || err).slice(0, 120) }
    }
  })()
  try {
    const kres = await fetch('https://mortera.cloud/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    })
    if (kres.ok) {
      const kb = await kres.json().catch(() => null) as { data?: { label?: string; billing_modes?: string[]; tier?: string } } | null
      if (kb?.data) {
        val.label = kb.data.label
        val.billingModes = kb.data.billing_modes
        val.tier = kb.data.tier
      }
    }
  } catch { /* opsional — credits saja sudah cukup */ }
  morteraWalletCache = { at: Date.now(), val }
  return val
}

export interface LLMCallOpts {
  /** Override model Mortera UNTUK PANGGILAN INI saja — dipakai tugas
   *  yang butuh kualitas tulisan premium (mis. konten Remotion Sinta
   *  → 'claude-sonnet-5-5', permintaan Bos: "make api berbayar biar
   *  bagus"). Gagal/404 → otomatis turun ke MORTERA_FALLBACKS lalu
   *  rantai gratis seperti biasa. */
  morteraModel?: string
  /** Override timeout PER PROVIDER untuk panggilan ini (ms). Default 40
   *  dtk — wajar buat agen background, TERLALU lama buat chat interaktif
   *  (4 provider hang berurutan = user nunggu 2+ menit). Chat CS pass
   *  12_000. */
  timeoutMs?: number
}

/** Ambang batas: kalau sisa anggaran waktu panggilan ini TIDAK cukup untuk
 *  mengulang model yang barusan timeout, jangan buang waktu mencoba ulang —
 *  langsung lanjut ke model/provider berikutnya. */
const RETRY_MIN_BUDGET_MS = 8_000

/**
 * Panggil LLM dengan system prompt + user prompt ATAU riwayat percakapan
 * (ConversationTurn[] — dipakai CS bot supaya self-healing juga berlaku di
 * chat multi-turn; produksi 2026-11-08: Gemini free tier habis kuota →
 * /api/chat 500 padahal rantai bisa mengambil alih). Returns null jika
 * tidak ada API key ataupun semua provider gagal — caller harus punya
 * fallback. Diagnosa kenapa gagal = getLastLLMDiag().
 */
export async function callLLM(systemPrompt: string, userPrompt: LLMUserInput, maxTokens = 800, opts?: LLMCallOpts): Promise<LLMResult | null> {
  const notes: string[] = []
  lastCallDiag = notes

  /* FIX CS LAMBAT: tarik cooldown lintas-isolate dari KV dulu — tanpa
     ini, isolate baru mencoba provider sakit dari nol (hang 40 dtk). */
  await hydrateCooldowns()

  /* PRIORITAS 1 — Mortera Cloud (deposit Rupiah, model kelas Claude/GPT). */
  const morteraKey = await getMorteraKey()
  if (morteraKey && !isCool('mortera')) {
    const res = await callMortera(morteraKey, systemPrompt, userPrompt, maxTokens, notes, opts?.morteraModel, opts?.timeoutMs)
    if (res) return { ...res, notes: notes.length ? notes : undefined }
    if (!isCool('mortera')) await cool('mortera', COOLDOWN_MS_LIMIT)
    notes.push(coolReason('mortera'))
  } else if (morteraKey && isCool('mortera')) {
    notes.push(`mortera dilompati — ${coolReason('mortera')}`)
  }

  const groqKey = await getGroqKey()
  if (groqKey && !isCool('groq')) {
    const res = await callGroq(groqKey, systemPrompt, userPrompt, maxTokens, notes, opts?.timeoutMs)
    if (res) return { ...res, notes: notes.length ? notes : undefined }
    if (!isCool('groq')) await cool('groq', COOLDOWN_MS_LIMIT)
    notes.push(coolReason('groq'))
  } else if (groqKey && isCool('groq')) {
    notes.push(`groq dilompati — ${coolReason('groq')}`)
  }

  const geminiKey = await getGeminiKey()
  if (geminiKey && !isCool('gemini')) {
    const res = await callGemini(geminiKey, systemPrompt, userPrompt, maxTokens, notes, opts?.timeoutMs)
    if (res) return { ...res, notes: notes.length ? notes : undefined }
    if (!isCool('gemini')) await cool('gemini', COOLDOWN_MS_LIMIT)
    notes.push(coolReason('gemini'))
  } else if (geminiKey && isCool('gemini')) {
    notes.push(`gemini dilompati — ${coolReason('gemini')}`)
  }

  const orKey = await getOpenRouterKey()
  if (orKey && !isCool('openrouter')) {
    const res = await callOpenRouter(orKey, systemPrompt, userPrompt, maxTokens, notes, opts?.timeoutMs)
    if (res) return { ...res, notes: notes.length ? notes : undefined }
    if (!isCool('openrouter')) await cool('openrouter', COOLDOWN_MS_LIMIT)
    notes.push(coolReason('openrouter'))
  } else if (orKey && isCool('openrouter')) {
    notes.push(`openrouter dilompati — ${coolReason('openrouter')}`)
  }

  if (!morteraKey && !groqKey && !geminiKey && !orKey) {
    console.warn('[ai-llm] Tidak ada MORTERA/GROQ/GEMINI/OPENROUTER_API_KEY — caller must use template fallback')
  }
  if (notes.length) console.warn('[ai-llm] Semua provider gagal:', notes.join(' | '))
  return null
}

/** OpenAI-compatible (Mortera, Groq & OpenRouter) + auto-discover. */
async function callOpenAICompatible(
  label: 'mortera' | 'groq' | 'openrouter',
  baseUrl: string,
  apiKey: string,
  models: string[],
  score: (id: string) => number,
  systemPrompt: string,
  userPrompt: LLMUserInput,
  maxTokens: number,
  notes: string[],
  temperature = 0.8,
  /** Override timeout per panggilan — draf artikel panjang butuh >40 dtk default. */
  timeoutMs?: number,
): Promise<LLMResult | null> {
  const t0 = Date.now()
  /* Anggaran total panggilan ini (untuk keputusan retry): kalau caller
     memberi timeoutMs pendek, anggap anggaran ≈ 3× timeout per model
     (cukup utk 1 retry + 1 model cadangan). Caller agentBrain yang
     budget-aware memangkas ini sebelum masuk ke sini. */
  const budgetMs = timeoutMs ? timeoutMs * 3 : 120_000
  const remaining = () => budgetMs - (Date.now() - t0)
  let sawModel404 = false
  for (const model of models) {
    /* FIX OTAK ALEXANDER: gateway Mortera kadang HANG sesaat (diag produksi
       10 Nov: "aborted due to timeout" di detik ke-20) padahal detik
       berikutnya sehat. Dulu 1 timeout = model ditanggalkan + provider
       didinginkan 5 menit → API berbayar tidak pernah sempat terbukti.
       Kini: timeout → coba SEKALI lagi model yang sama (koneksi baru),
       hanya kalau anggaran waktu masih cukup. ⏱️ Retry pakai SETENGAH timeout
       (probe cepat): kalau gateway cuma ngantuk, Haiku jawab <15 dtk;
       kalau gantung lagi, buang waktu lebih sedikit — anggaran caller
       (compose 30-75 dtk) tidak habis di satu provider. */
    const retryTimeout = Math.max(6_000, Math.floor((timeoutMs ?? 40_000) / 2))
    let r = await callOpenAIModel(label, baseUrl, apiKey, model, systemPrompt, userPrompt, maxTokens, notes, temperature, timeoutMs)
    if (!r.ok && r.timedOut && remaining() >= RETRY_MIN_BUDGET_MS) {
      notes.push(`${label} ${model} timeout → retry sekali (${Math.round(retryTimeout / 1000)} dtk)`)
      r = await callOpenAIModel(label, baseUrl, apiKey, model, systemPrompt, userPrompt, maxTokens, notes, temperature, retryTimeout)
    }
    if (r.ok && r.result) return r.result
    if (r.model404) sawModel404 = true
    /* FIX 2026-11-08 (produksi nyata): dulu 429 → LANGSUNG `return null` —
       padahal model sebelumnya 404 (katalog provider berganti, contoh
       Mortera: claude-haiku-5.5 & claude-sonnet-5.5 mati) → AUTO-DISCOVER
       tak pernah jalan → provider "mati" sampai deploy ulang. Sekarang
       hardStop cuma menghentikan loop; discover tetap dicoba kalau ada
       indikasi 404 lebih dulu. */
    if (r.hardStop) break
  }
  /* AUTO-DISCOVER: semua model hardcoded mati → tanya provider langsung.
     Coba hingga 3 kandidat terbaik (skor tertinggi dulu). */
  if (sawModel404) {
    const alts = await discoverOpenAIModels(label, baseUrl, apiKey, score)
    const fresh = alts.filter((m) => !models.includes(m))
    if (fresh.length) {
      notes.push(`${label} auto-discover kandidat: ${fresh.join(', ')}`)
      for (const alt of fresh) {
        const r = await callOpenAIModel(label, baseUrl, apiKey, alt, systemPrompt, userPrompt, maxTokens, notes, temperature, timeoutMs)
        if (r.ok && r.result) return r.result
        if (r.hardStop) break
      }
    } else {
      /* Semua model mati + discover tak menemukan apa pun → pendinginkan
         provider (10 mnt). Dulu dibiarkan dingin-0: tiap panggilan
         berikutnya mengulang 3× model 404 + GET /models — pemborosan
         subrequest yang menembus limit 50/invokasi (insiden
         master-autonomous 8 Nov, log CF Bos). */
      notes.push(`${label} auto-discover tidak menemukan kandidat layak → pendinginkan 10 mnt`)
      await cool(label, COOLDOWN_MS_LIMIT)
    }
  }
  return null
}

async function callOpenAIModel(
  label: 'mortera' | 'groq' | 'openrouter',
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: LLMUserInput,
  maxTokens: number,
  notes: string[],
  temperature = 0.8,
  timeoutMs = 40_000,
): Promise<{ ok: boolean; result?: LLMResult; hardStop?: boolean; model404?: boolean; timedOut?: boolean }> {
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(label === 'openrouter' ? { 'HTTP-Referer': 'https://luxtradee.web.id', 'X-Title': 'Luxtradee AI Staff' } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...toTurns(userPrompt).map((t) => ({ role: t.role, content: t.content })),
        ],
        temperature,
        /* FIX AKAR MASALAH 8 Nov 2026 (diag transparansi produksi):
           dulu SEMUA panggilan dipaksa max_tokens min 4000 — padahal
           Mortera PRE-AUTHORIZE biaya maksimum = prompt + max_tokens.
           Saldo Bos kecil → wallet "cannot cover this request's maximum
           cost" → 429 padahal saldo ADA (pesannya sendiri menyuruh
           "send a smaller max_tokens"). Floor 4000 kini HANYA utk model
           reasoning (budget-nya dimakan reasoning sebelum content);
           model biasa kirim maxTokens apa adanya sesuai kebutuhan caller
           (chat 1024, artikel 2600 — semua caller panjang sudah eksplisit). */
        max_tokens: /gpt-oss|thinking/i.test(model) ? Math.max(maxTokens, 4000) : maxTokens,
        ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error(`[ai-llm] ${label} ${res.status} (${model}): ${errBody.substring(0, 180)}`)
      if (res.status === 404 || res.status === 400) {
        notes.push(`${label} model ${model} mati → coba cadangan`)
        return { ok: false, model404: true } // model hilang → model berikutnya
      }
      if (res.status === 429) {
        /* TRANSPARANSI (keluhan Bos: "udah isi saldo kok masih error?"):
           429 ≠ selalu kuota harian — bisa RPM per-menit, bisa key akun
           lain, bisa saldo belum aktif. Pesan ASLI provider masuk diag
           supaya sebabnya terlihat di /api/health tanpa buka log CF.
           Retry-After (detik) dihormati, dibatasi maks 10 menit. */
        const raSec = Number(res.headers.get('retry-after'))
        const hint = errBody.replace(/\s+/g, ' ').trim().slice(0, 140)
        notes.push(`${label} 429 rate-limit (model ${model})${hint ? ` — provider: ${hint}` : ''} → cooldown + pindah provider`)
        await cool(label, Number.isFinite(raSec) && raSec > 0 ? Math.min(raSec * 1000, COOLDOWN_MS_LIMIT) : COOLDOWN_MS_LIMIT)
        return { ok: false, hardStop: true }
      }
      if (res.status === 401 || res.status === 403) {
        notes.push(`${label} ${res.status} auth bermasalah → cooldown 60 menit`)
        await cool(label, COOLDOWN_MS_AUTH)
        return { ok: false, hardStop: true }
      }
      if (res.status === 402) {
        // Khusus Mortera: wallet habis — capek coba model lain, lompat
        // provider; rantai free mengambil alih sampai Bos top-up.
        // Pesan asli provider ikut dicatat → kalau Bos SUDAH top-up tapi
        // masih 402, sebabnya kelihatan langsung (mis. key akun yang lain).
        const hint = errBody.replace(/\s+/g, ' ').trim().slice(0, 140)
        notes.push(`${label} 402 saldo/wallet habis${hint ? ` — provider: ${hint}` : ''} → cooldown 60 menit + rantai free mengambil alih`)
        await cool(label, COOLDOWN_MS_AUTH)
        return { ok: false, hardStop: true }
      }
      if (res.status >= 500) {
        notes.push(`${label} HTTP ${res.status} (model ${model}) → coba model/provider lain`)
        return { ok: false } // overload sementara → model/provider berikutnya
      }
      notes.push(`${label} HTTP ${res.status} (${model})`)
      return { ok: false, hardStop: true }
    }

    const data = await res.json()
    const msg = data?.choices?.[0]?.message
    let text: string | undefined = msg?.content
    if ((!text || !text.trim()) && msg) {
      // Model reasoning (gpt-oss/flint dll) kadang menaruh jawaban di field
      // reasoning dan membiarkan content kosong — coba ambil dari sana
      // (extractJson di caller akan mencari blok JSON yang seimbang).
      const reasoning = String(msg.reasoning || msg.reasoning_content || '')
      if (reasoning.trim()) {
        notes.push(`${label} ${model} content kosong — pakai field reasoning`)
        text = reasoning
      }
    }
    if (!text || !text.trim()) {
      console.error(`[ai-llm] ${label} returned empty content (${model})`)
      notes.push(`${label} ${model} jawaban kosong`)
      return { ok: false }
    }
    notes.push(`${label} memakai model ${model}`)
    return { ok: true, result: { text: text.trim(), provider: label, model } }
  } catch (err: any) {
    console.error(`[ai-llm] ${label} error (${model}):`, err?.message || err)
    notes.push(`${label} ${model} error: ${String(err?.message || err).slice(0, 80)}`)
    /* FIX CS LAMBAT: dulu timeout/network error TANPA cooldown — provider
       yang menggantung dicoba LAGI di pesan berikutnya (isolate CF juga
       ganti-ganti, memori cooldown kosong) → user menunggu 40 dtk berulang.
       Cooldown tetap dipakai, hanya durasinya yang disesuaikan: */
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError' || /timeout|timed out/i.test(String(err?.message || ''))
    /* FIX OTAK ALEXANDER: timeout = hang SEMENTARA → cooldown 90 dtk saja
       (dulu 5 menit — memvakumkan API berbayar kelima karyawan sekaligus,
       lihat komentar COOLDOWN_MS_TIMEOUT). Network error lain → 1 menit. */
    notes.push(isTimeout ? `${label} timeout → cooldown 90 detik (bukan 5 menit)` : `${label} network error → cooldown 1 menit`)
    await cool(label, isTimeout ? COOLDOWN_MS_TIMEOUT : 60_000)
    return { ok: false, hardStop: true, timedOut: isTimeout } // network error → provider lain
  }
}

async function callGroq(apiKey: string, systemPrompt: string, userPrompt: LLMUserInput, maxTokens: number, notes: string[], timeoutMs?: number): Promise<LLMResult | null> {
  return callOpenAICompatible('groq', 'https://api.groq.com/openai/v1', apiKey, [GROQ_MODEL, ...GROQ_FALLBACKS], groqScore, systemPrompt, userPrompt, maxTokens, notes, 0.8, timeoutMs)
}

/* ── MORTERA CLOUD (mortera.cloud/v1) ──────────────────────────────
   Gateway OpenAI-compatible billing Rupiah. Auto-discover pakai
   morteraScore: prefer Sonnet/Haiku/Terra, HARD-VETO Fable/Opus
   + katalog uncensored & image (mahal / tidak kita perlukan) supaya
   fallback otomatis tidak pernah nyasar ke model mahal. */
const morteraScore = (id: string) => {
  if (/fable|opus|uncensored|abliterated|image|video|embed|whisper|tts|nano ?banana|imagine/i.test(id)) return -100
  /* Permintaan Bos "ganti api ke sonnet semua": auto-discover juga UTAMAKAN
     Sonnet (50) di atas Haiku (30) supaya fallback otomatis tak turun kelas. */
  return (/sonnet/i.test(id) ? 50 : 0) + (/haiku/i.test(id) ? 30 : 0) + (/terra/i.test(id) ? 20 : 0) + (/flash/i.test(id) ? 10 : 0) - (/latest|preview|exp/i.test(id) ? 5 : 0)
}

async function callMortera(apiKey: string, systemPrompt: string, userPrompt: LLMUserInput, maxTokens: number, notes: string[], modelOverride?: string, timeoutMs?: number): Promise<LLMResult | null> {
  const chain = [...new Set([modelOverride?.trim() || MORTERA_MODEL, MORTERA_MODEL, ...MORTERA_FALLBACKS])]
  return callOpenAICompatible('mortera', 'https://mortera.cloud/v1', apiKey, chain, morteraScore, systemPrompt, userPrompt, maxTokens, notes, 0.8, timeoutMs)
}

/** Panggil Mortera LANGSUNG — tanpa rotasi ke provider lain. Untuk route yang
 * punya rantai cadangan sendiri (ceo-agent agentBrain). Dapat SEMUA perlakuan
 * hardened rantai callLLM: 404/400 → model cadangan → AUTO-DISCOVER GET /models
 * (menyembuhkan model-ID salah tanpa deploy), 429 → cooldown 10 mnt,
 * 401/402/403 → cooldown 60 mnt. Null = gagal — notes berisi alasan tiap
 * percobaan (tampilkan supaya 'jatuh ke templat' SELALU ada penjelasannya). */
export async function callMorteraDirect(
  systemPrompt: string,
  userPrompt: LLMUserInput,
  maxTokens = 1024,
  notes: string[] = [],
  temperature = 0.8,
  /** Override timeout per panggilan (ms) — default 40 dtk; draf artikel
   *  panjang (600-900 kata) di karyawan master-autonomous pakai 90-120 dtk. */
  timeoutMs?: number,
): Promise<LLMResult | null> {
  const key = await getMorteraKey()
  if (!key) { notes.push('mortera: MORTERA_API_KEY belum diset — lompat ke rantai cadangan'); return null }
  if (isCool('mortera')) { notes.push(`mortera dilompati — ${coolReason('mortera')}`); return null }
  return callOpenAICompatible('mortera', 'https://mortera.cloud/v1', key, [MORTERA_MODEL, ...MORTERA_FALLBACKS], morteraScore, systemPrompt, userPrompt, maxTokens, notes, temperature, timeoutMs)
}

async function callOpenRouter(apiKey: string, systemPrompt: string, userPrompt: LLMUserInput, maxTokens: number, notes: string[], timeoutMs?: number): Promise<LLMResult | null> {
  return callOpenAICompatible('openrouter', 'https://openrouter.ai/api/v1', apiKey, [OPENROUTER_MODEL, ...OPENROUTER_FALLBACKS], openrouterScore, systemPrompt, userPrompt, maxTokens, notes, 0.8, timeoutMs)
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: LLMUserInput,
  maxTokens: number,
  notes: string[],
  timeoutMs = 40_000,
): Promise<{ ok: boolean; result?: LLMResult; model404?: boolean }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: toGeminiContents(userPrompt),
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: Math.max(maxTokens, 4000),
            // Gemini 2.5 = thinking model: reasoning memakan output token
            // sampai JSON terpotong → validSpec gagal. Matikan thinking.
            ...(/2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    )

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error(`[ai-llm] Gemini ${res.status} (${model}): ${errBody.substring(0, 180)}`)
      if (res.status === 404 || res.status === 400) {
        notes.push(`gemini model ${model} mati → coba cadangan`)
        return { ok: false, model404: true }
      }
      if (res.status === 429) {
        notes.push('gemini 429 rate-limit → cooldown + pindah provider')
        await cool('gemini', COOLDOWN_MS_LIMIT)
        return { ok: false }
      }
      if (res.status === 401 || res.status === 403) {
        notes.push(`gemini ${res.status} auth bermasalah → cooldown 60 menit`)
        await cool('gemini', COOLDOWN_MS_AUTH)
        return { ok: false }
      }
      if (res.status >= 500) {
        // 503 = overload sementara → JANGAN menyerah, coba model berikutnya
        notes.push(`gemini HTTP ${res.status} (${model}) overload → coba model lain`)
        return { ok: false }
      }
      notes.push(`gemini HTTP ${res.status} (${model})`)
      return { ok: false }
    }

    const data = await res.json()
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text || '')
      .join('')
    if (!text || !text.trim()) {
      console.error(`[ai-llm] Gemini returned empty content (${model})`)
      notes.push(`gemini ${model} jawaban kosong`)
      return { ok: false }
    }
    notes.push(`gemini memakai model ${model}`)
    return { ok: true, result: { text: text.trim(), provider: 'gemini', model } }
  } catch (err: any) {
    console.error(`[ai-llm] Gemini error (${model}):`, err?.message || err)
    notes.push(`gemini ${model} error: ${String(err?.message || err).slice(0, 80)}`)
    /* FIX CS LAMBAT: sama seperti rantai OpenAI-compatible — timeout/network
       tetap didinginkan supaya isolate berikutnya lompat langsung, bukan
       menggantung 40 dtk dari nol. Durasi timeout: 90 dtk (lihat
       COOLDOWN_MS_TIMEOUT). */
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError' || /timeout|timed out/i.test(String(err?.message || ''))
    notes.push(isTimeout ? 'gemini timeout → cooldown 90 detik (bukan 5 menit)' : 'gemini network error → cooldown 1 menit')
    await cool('gemini', isTimeout ? COOLDOWN_MS_TIMEOUT : 60_000)
    return { ok: false }
  }
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: LLMUserInput, maxTokens: number, notes: string[], timeoutMs?: number): Promise<LLMResult | null> {
  let saw404 = false
  for (const model of [GEMINI_MODEL, ...GEMINI_FALLBACKS]) {
    const r = await callGeminiModel(apiKey, model, systemPrompt, userPrompt, maxTokens, notes, timeoutMs)
    if (r.ok) return r.result!
    if (r.model404) saw404 = true
  }
  /* AUTO-DISCOVER: daftar model langsung dari Google, coba 3 kandidat */
  if (saw404) {
    const alts = await discoverGeminiModels(apiKey)
    const fresh = alts.filter((m) => m !== GEMINI_MODEL && !GEMINI_FALLBACKS.includes(m))
    if (fresh.length) {
      notes.push(`gemini auto-discover kandidat: ${fresh.join(', ')}`)
      for (const alt of fresh) {
        const r = await callGeminiModel(apiKey, alt, systemPrompt, userPrompt, maxTokens, notes, timeoutMs)
        if (r.ok) return r.result!
      }
    } else {
      /* Semua model mati + discover kosong → pendinginkan (anti badai
         subrequest, lihat catatan di callOpenAICompatible). */
      notes.push('gemini auto-discover tidak menemukan kandidat layak → pendinginkan 10 mnt')
      await cool('gemini', COOLDOWN_MS_LIMIT)
    }
  }
  return null
}

/**
 * Ekstrak objek/array JSON dari balasan LLM — tahan banting terhadap
 * markdown fence (```json ... ```), teks pembuka, dan penutup basa-basi.
 */
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null
  let s = raw.trim()

  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')

  // Coba parse langsung
  try { return JSON.parse(s) as T } catch { /* lanjut ke pencarian seimbang */ }

  // Cari blok {..} atau [..] paling luar yang seimbang
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const start = s.indexOf(open)
    if (start === -1) continue
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = start; i < s.length; i++) {
      const ch = s[i]
      if (esc) { esc = false; continue }
      if (ch === '\\') { if (inStr) esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) {
          const candidate = s.slice(start, i + 1)
          try { return JSON.parse(candidate) as T } catch { break }
        }
      }
    }
  }
  return null
}
