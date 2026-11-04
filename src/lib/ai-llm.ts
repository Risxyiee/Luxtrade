import { getEnvVar } from '@/lib/cloudflare-bindings'

/**
 * Shared LLM helper untuk AI Staff agents — Cloudflare Workers safe.
 *
 * Menggunakan raw fetch (bukan SDK) karena beberapa SDK AI memakai
 * fs/node API yang tidak tersedia di CF Workers runtime.
 *
 * ═══════════════════════════════════════════════════════════════════
 * RANTAI PROVIDER SELF-HEALING (permintaan Bos Nov 2026):
 * "perbaiki api yang limit — karyawan ai ganti ke yang baru dan free
 *  biar tetep bekerja"
 *
 *   Groq (llama-3.3-70b, free) → Gemini (gemini-3.8-flash, free) →
 *   OpenRouter (model :free, kalau OPENROUTER_API_KEY ada) → null
 *
 * Aturan rotasi otomatis:
 *   • 429 / quota / rate-limit → provider itu DIDINGINKAN 10 menit
 *     (call berikutnya langsung lompat ke provider lain, tidak buang
 *     waktu + tidak memperparah limit) → dicatat sebagai "note".
 *   • 404/400 → model dimatikan provider → coba model cadangan di
 *     provider yang sama dulu, baru pindah provider.
 *   • 401/403 (key salah/expired) → provider itu didinginkan 60 menit.
 *   • Semua keputusan dikembalikan via `notes` — caller (mis. Sinta)
 *     menuliskannya ke office_memory sebagai pelajaran → karyawan AI
 *     "tahu" provider mana yang bermasalah hari itu.
 *
 * Model bisa dioverride via env GROQ_MODEL / GEMINI_MODEL /
 * OPENROUTER_MODEL. Semua provider di rantai ini punya tier GRATIS.
 * ═══════════════════════════════════════════════════════════════════
 */

export interface LLMResult {
  text: string
  provider: 'groq' | 'gemini' | 'openrouter'
  model: string
  /** Catatan rotasi/fallback yang terjadi (untuk office_memory Sinta). */
  notes?: string[]
}

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
/** Model cadangan kalau model utama sudah dimatikan provider (HTTP 404/400). */
const GROQ_FALLBACKS = ['llama-3.1-8b-instant']
const GEMINI_FALLBACKS = ['gemini-flash-latest', 'gemini-2.5-flash']
const OPENROUTER_FALLBACKS = ['deepseek/deepseek-chat-v3-0324:free', 'google/gemini-2.0-flash-exp:free']

/* ── Cooldown antar-panggilan (per isolate Workers) ─────────────────
   429 = provider kena limit → jangan sentuh lagi selama 10 menit.
   401/403 = key bermasalah → 60 menit. Ini bikin rotasi "pintar":
   percobaan pertama setelah pemulihan tetap dicoba ulang, tapi
   tidak mengganggu provider yang sehat. */
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

/** Diagnosa rotasi dari callLLM TERAKHIR (termasuk saat gagal total) —
 *  dipakai caller utk menulis incident ke office_memory. Per-isolate. */
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
    if (!isCool('groq')) cool('groq', COOLDOWN_MS_LIMIT) // gagal tanpa status jelas → jangan spam
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

/** OpenAI-compatible (Groq & OpenRouter) — beda base URL + model list. */
async function callOpenAICompatible(
  label: 'groq' | 'openrouter',
  baseUrl: string,
  apiKey: string,
  models: string[],
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  notes: string[],
): Promise<LLMResult | null> {
  for (const model of models) {
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
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        console.error(`[ai-llm] ${label} ${res.status} (${model}): ${errBody.substring(0, 180)}`)
        if (res.status === 404 || res.status === 400) {
          notes.push(`${label} model ${model} mati → coba cadangan`)
          continue // model hilang/deprecated → model berikutnya
        }
        if (res.status === 429) {
          notes.push(`${label} 429 rate-limit (model ${model}) → cooldown + pindah provider`)
          cool(label, COOLDOWN_MS_LIMIT)
          return null // langsung pindah provider, jangan paksa
        }
        if (res.status === 401 || res.status === 403) {
          notes.push(`${label} ${res.status} auth bermasalah → cooldown 60 menit`)
          cool(label, COOLDOWN_MS_AUTH)
          return null
        }
        notes.push(`${label} HTTP ${res.status} (${model})`)
        return null
      }

      const data = await res.json()
      const text: string | undefined = data?.choices?.[0]?.message?.content
      if (!text || !text.trim()) {
        console.error(`[ai-llm] ${label} returned empty content (${model})`)
        notes.push(`${label} ${model} jawaban kosong`)
        continue
      }
      if (model !== models[0]) notes.push(`${label} fallback ke ${model}`)
      return { text: text.trim(), provider: label, model }
    } catch (err: any) {
      console.error(`[ai-llm] ${label} error (${model}):`, err?.message || err)
      notes.push(`${label} ${model} error: ${String(err?.message || err).slice(0, 80)}`)
      return null
    }
  }
  return null
}

async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, notes: string[]): Promise<LLMResult | null> {
  return callOpenAICompatible('groq', 'https://api.groq.com/openai/v1', apiKey, [GROQ_MODEL, ...GROQ_FALLBACKS], systemPrompt, userPrompt, maxTokens, notes)
}

async function callOpenRouter(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, notes: string[]): Promise<LLMResult | null> {
  return callOpenAICompatible('openrouter', 'https://openrouter.ai/api/v1', apiKey, [OPENROUTER_MODEL, ...OPENROUTER_FALLBACKS], systemPrompt, userPrompt, maxTokens, notes)
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, notes: string[]): Promise<LLMResult | null> {
  for (const model of [GEMINI_MODEL, ...GEMINI_FALLBACKS]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: maxTokens },
          }),
          signal: AbortSignal.timeout(25000),
        }
      )

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        console.error(`[ai-llm] Gemini ${res.status} (${model}): ${errBody.substring(0, 180)}`)
        if (res.status === 404 || res.status === 400) {
          notes.push(`gemini model ${model} mati → coba cadangan`)
          continue
        }
        if (res.status === 429) {
          notes.push('gemini 429 rate-limit → cooldown + pindah provider')
          cool('gemini', COOLDOWN_MS_LIMIT)
          return null
        }
        if (res.status === 401 || res.status === 403) {
          notes.push(`gemini ${res.status} auth bermasalah → cooldown 60 menit`)
          cool('gemini', COOLDOWN_MS_AUTH)
          return null
        }
        notes.push(`gemini HTTP ${res.status} (${model})`)
        return null
      }

      const data = await res.json()
      const text: string | undefined = data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text || '')
        .join('')
      if (!text || !text.trim()) {
        console.error(`[ai-llm] Gemini returned empty content (${model})`)
        notes.push(`gemini ${model} jawaban kosong`)
        continue
      }
      if (model !== GEMINI_MODEL) notes.push(`gemini fallback ke ${model}`)
      return { text: text.trim(), provider: 'gemini', model }
    } catch (err: any) {
      console.error(`[ai-llm] Gemini error (${model}):`, err?.message || err)
      notes.push(`gemini ${model} error: ${String(err?.message || err).slice(0, 80)}`)
      return null
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
