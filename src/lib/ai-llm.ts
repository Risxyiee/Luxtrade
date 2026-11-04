import { getEnvVar } from '@/lib/cloudflare-bindings'

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
 *   Groq (free) → Gemini (free) → OpenRouter (:free) → null
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
 * Override model via env GROQ_MODEL / GEMINI_MODEL / OPENROUTER_MODEL.
 * ═══════════════════════════════════════════════════════════════════
 */

export interface LLMResult {
  text: string
  provider: 'groq' | 'gemini' | 'openrouter'
  model: string
  /** Catatan rotasi/fallback/discover yang terjadi (untuk office_memory). */
  notes?: string[]
}

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
/** Model cadangan kalau model utama sudah dimatikan provider (HTTP 404/400). */
const GROQ_FALLBACKS = ['llama-3.1-8b-instant']
const GEMINI_FALLBACKS = ['gemini-flash-latest', 'gemini-2.5-flash']
const OPENROUTER_FALLBACKS = ['deepseek/deepseek-chat-v3-0324:free', 'google/gemini-2.0-flash-exp:free']

/* ── Cooldown antar-panggilan (per isolate Workers) ─────────────── */
const COOLDOWN_MS_LIMIT = 10 * 60 * 1000
const COOLDOWN_MS_AUTH = 60 * 60 * 1000
const providerCoolUntil = new Map<string, number>()

function isCool(provider: string): boolean {
  const until = providerCoolUntil.get(provider) || 0
  return Date.now() < until
}
function cool(provider: string, ms: number): void {
  providerCoolUntil.set(provider, Date.now() + ms)
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
const discovered = new Map<string, { models: string[]; until: number }>()

async function discoverOpenAIModels(
  label: 'groq' | 'openrouter',
  baseUrl: string,
  apiKey: string,
  score: (id: string) => number,
): Promise<string[]> {
  const hit = discovered.get(label)
  if (hit && Date.now() < hit.until) return hit.models
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return []
    const data = await res.json() as { data?: { id?: string }[] }
    const ids = (data?.data || []).map((m) => String(m?.id || '')).filter(Boolean)
    if (!ids.length) return []
    const ranked = [...ids].sort((a, b) => score(b) - score(a)).filter((id) => score(id) > 0).slice(0, 3)
    if (!ranked.length) return []
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
    if (!res.ok) return []
    const data = await res.json() as { models?: { name?: string; supportedGenerationMethods?: string[] }[] }
    const usable = (data?.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((id) => id && !/embedding|aqa|image|audio|tts|veo/i.test(id))
    if (!usable.length) return []
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

/** Cek ketersediaan LLM tanpa melakukan panggilan (untuk logging & response meta). */
export async function getLLMProviderName(): Promise<'groq' | 'gemini' | 'openrouter' | 'template'> {
  if (await getGroqKey()) return 'groq'
  if (await getGeminiKey()) return 'gemini'
  if (await getOpenRouterKey()) return 'openrouter'
  return 'template'
}

/** Status rantai provider — untuk diagnostik (route GET / log admin). */
export async function getLLMChainStatus(): Promise<{ provider: string; ok: boolean; reason?: string }[]> {
  const out: { provider: string; ok: boolean; reason?: string }[] = []
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

/**
 * Panggil LLM dengan system + user prompt. Returns null jika tidak ada
 * API key ataupun semua provider gagal — caller harus punya fallback.
 * Diagnosa kenapa gagal = getLastLLMDiag().
 */
export async function callLLM(systemPrompt: string, userPrompt: string, maxTokens = 800): Promise<LLMResult | null> {
  const notes: string[] = []
  lastCallDiag = notes

  const groqKey = await getGroqKey()
  if (groqKey && !isCool('groq')) {
    const res = await callGroq(groqKey, systemPrompt, userPrompt, maxTokens, notes)
    if (res) return { ...res, notes: notes.length ? notes : undefined }
    if (!isCool('groq')) cool('groq', COOLDOWN_MS_LIMIT)
    notes.push(coolReason('groq'))
  } else if (groqKey && isCool('groq')) {
    notes.push(`groq dilompati — ${coolReason('groq')}`)
  }

  const geminiKey = await getGeminiKey()
  if (geminiKey && !isCool('gemini')) {
    const res = await callGemini(geminiKey, systemPrompt, userPrompt, maxTokens, notes)
    if (res) return { ...res, notes: notes.length ? notes : undefined }
    if (!isCool('gemini')) cool('gemini', COOLDOWN_MS_LIMIT)
    notes.push(coolReason('gemini'))
  } else if (geminiKey && isCool('gemini')) {
    notes.push(`gemini dilompati — ${coolReason('gemini')}`)
  }

  const orKey = await getOpenRouterKey()
  if (orKey && !isCool('openrouter')) {
    const res = await callOpenRouter(orKey, systemPrompt, userPrompt, maxTokens, notes)
    if (res) return { ...res, notes: notes.length ? notes : undefined }
    if (!isCool('openrouter')) cool('openrouter', COOLDOWN_MS_LIMIT)
    notes.push(coolReason('openrouter'))
  } else if (orKey && isCool('openrouter')) {
    notes.push(`openrouter dilompati — ${coolReason('openrouter')}`)
  }

  if (!groqKey && !geminiKey && !orKey) {
    console.warn('[ai-llm] Tidak ada GROQ/GEMINI/OPENROUTER_API_KEY — caller must use template fallback')
  }
  if (notes.length) console.warn('[ai-llm] Semua provider gagal:', notes.join(' | '))
  return null
}

/** OpenAI-compatible (Groq & OpenRouter) + auto-discover. */
async function callOpenAICompatible(
  label: 'groq' | 'openrouter',
  baseUrl: string,
  apiKey: string,
  models: string[],
  score: (id: string) => number,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  notes: string[],
): Promise<LLMResult | null> {
  let sawModel404 = false
  for (const model of models) {
    const r = await callOpenAIModel(label, baseUrl, apiKey, model, systemPrompt, userPrompt, maxTokens, notes)
    if (r.ok) return r.result
    if (r.hardStop) return null
    if (r.model404) sawModel404 = true
  }
  /* AUTO-DISCOVER: semua model hardcoded mati → tanya provider langsung.
     Coba hingga 3 kandidat terbaik (skor tertinggi dulu). */
  if (sawModel404) {
    const alts = await discoverOpenAIModels(label, baseUrl, apiKey, score)
    const fresh = alts.filter((m) => !models.includes(m))
    if (fresh.length) {
      notes.push(`${label} auto-discover kandidat: ${fresh.join(', ')}`)
      for (const alt of fresh) {
        const r = await callOpenAIModel(label, baseUrl, apiKey, alt, systemPrompt, userPrompt, maxTokens, notes)
        if (r.ok) return r.result
        if (r.hardStop) return null
      }
    } else if (!alts.length) {
      notes.push(`${label} auto-discover tidak menemukan kandidat layak`)
    }
  }
  return null
}

async function callOpenAIModel(
  label: 'groq' | 'openrouter',
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  notes: string[],
): Promise<{ ok: boolean; result?: LLMResult; hardStop?: boolean; model404?: boolean }> {
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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        // Reasoning model (gpt-oss dll) butuh budget besar — reasoning-nya
        // memakan token sebelum content, kalau kecil → content kosong.
        max_tokens: Math.max(maxTokens, 4000),
        ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
      signal: AbortSignal.timeout(40000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error(`[ai-llm] ${label} ${res.status} (${model}): ${errBody.substring(0, 180)}`)
      if (res.status === 404 || res.status === 400) {
        notes.push(`${label} model ${model} mati → coba cadangan`)
        return { ok: false, model404: true } // model hilang → model berikutnya
      }
      if (res.status === 429) {
        notes.push(`${label} 429 rate-limit (model ${model}) → cooldown + pindah provider`)
        cool(label, COOLDOWN_MS_LIMIT)
        return { ok: false, hardStop: true }
      }
      if (res.status === 401 || res.status === 403) {
        notes.push(`${label} ${res.status} auth bermasalah → cooldown 60 menit`)
        cool(label, COOLDOWN_MS_AUTH)
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
    return { ok: false, hardStop: true } // network error → provider lain
  }
}

async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, notes: string[]): Promise<LLMResult | null> {
  return callOpenAICompatible('groq', 'https://api.groq.com/openai/v1', apiKey, [GROQ_MODEL, ...GROQ_FALLBACKS], groqScore, systemPrompt, userPrompt, maxTokens, notes)
}

async function callOpenRouter(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, notes: string[]): Promise<LLMResult | null> {
  return callOpenAICompatible('openrouter', 'https://openrouter.ai/api/v1', apiKey, [OPENROUTER_MODEL, ...OPENROUTER_FALLBACKS], openrouterScore, systemPrompt, userPrompt, maxTokens, notes)
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  notes: string[],
): Promise<{ ok: boolean; result?: LLMResult; model404?: boolean }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: Math.max(maxTokens, 4000),
            // Gemini 2.5 = thinking model: reasoning memakan output token
            // sampai JSON terpotong → validSpec gagal. Matikan thinking.
            ...(/2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: AbortSignal.timeout(40000),
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
        cool('gemini', COOLDOWN_MS_LIMIT)
        return { ok: false }
      }
      if (res.status === 401 || res.status === 403) {
        notes.push(`gemini ${res.status} auth bermasalah → cooldown 60 menit`)
        cool('gemini', COOLDOWN_MS_AUTH)
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
    return { ok: false }
  }
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, notes: string[]): Promise<LLMResult | null> {
  let saw404 = false
  for (const model of [GEMINI_MODEL, ...GEMINI_FALLBACKS]) {
    const r = await callGeminiModel(apiKey, model, systemPrompt, userPrompt, maxTokens, notes)
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
        const r = await callGeminiModel(apiKey, alt, systemPrompt, userPrompt, maxTokens, notes)
        if (r.ok) return r.result!
      }
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
