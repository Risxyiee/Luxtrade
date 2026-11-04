import { getEnvVar } from '@/lib/cloudflare-bindings'

/**
 * Shared LLM helper untuk AI Staff agents — Cloudflare Workers safe.
 *
 * Menggunakan raw fetch (bukan SDK) karena beberapa SDK AI memakai
 * fs/node API yang tidak tersedia di CF Workers runtime.
 *
 * Rantai provider: GROQ_API_KEY (llama-3.3-70b, cepat & gratis) →
 * GEMINI_API_KEY (gemini-3.8-flash; dulu gemini-2.0-flash — DIMATIKAN
 * Google pada Nov 2026, respons 404) → null (pemanggil wajib punya
 * fallback template sendiri agar cron tetap menghasilkan draf).
 *
 * Model bisa dioverride via env GROQ_MODEL / GEMINI_MODEL. Kalau model
 * utama 404/deprecated, otomatis coba model cadangan di bawah.
 */

export interface LLMResult {
  text: string
  provider: 'groq' | 'gemini' | 'openrouter'
  model: string
}

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
/** Model cadangan kalau model utama sudah dimatikan provider (HTTP 404/400). */
const GROQ_FALLBACKS = ['llama-3.1-8b-instant']
const GEMINI_FALLBACKS = ['gemini-flash-latest', 'gemini-2.5-flash']

async function getGroqKey(): Promise<string> {
  try { return (await getEnvVar('GROQ_API_KEY', { quiet: true })) || process.env.GROQ_API_KEY || '' } catch { return process.env.GROQ_API_KEY || '' }
}

async function getGeminiKey(): Promise<string> {
  try { return (await getEnvVar('GEMINI_API_KEY', { quiet: true })) || process.env.GEMINI_API_KEY || '' } catch { return process.env.GEMINI_API_KEY || '' }
}

/** Cek ketersediaan LLM tanpa melakukan panggilan (untuk logging & response meta). */
export async function getLLMProviderName(): Promise<'groq' | 'gemini' | 'template'> {
  if (await getGroqKey()) return 'groq'
  if (await getGeminiKey()) return 'gemini'
  return 'template'
}

/**
 * Panggil LLM dengan system + user prompt. Returns null jika tidak ada
 * API key ataupun kedua provider gagal — caller harus punya fallback.
 */
export async function callLLM(systemPrompt: string, userPrompt: string, maxTokens = 800): Promise<LLMResult | null> {
  const groqKey = await getGroqKey()
  if (groqKey) {
    const res = await callGroq(groqKey, systemPrompt, userPrompt, maxTokens)
    if (res) return res
    console.warn('[ai-llm] Groq failed, trying Gemini fallback')
  }

  const geminiKey = await getGeminiKey()
  if (geminiKey) {
    return await callGemini(geminiKey, systemPrompt, userPrompt, maxTokens)
  }

  if (!groqKey && !geminiKey) {
    console.warn('[ai-llm] No GROQ_API_KEY / GEMINI_API_KEY configured — caller must use template fallback')
  }
  return null
}

async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<LLMResult | null> {
  for (const model of [GROQ_MODEL, ...GROQ_FALLBACKS]) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
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
        console.error(`[ai-llm] Groq ${res.status} (${model}): ${errBody.substring(0, 200)}`)
        // 404/400 = model dimatikan/deprecated → coba model cadangan.
        // Selain itu (401 key salah, 429 rate limit) → percuma ganti model, stop.
        if (res.status === 404 || res.status === 400) continue
        return null
      }

      const data = await res.json()
      const text: string | undefined = data?.choices?.[0]?.message?.content
      if (!text || !text.trim()) {
        console.error(`[ai-llm] Groq returned empty content (${model})`)
        continue
      }
      return { text: text.trim(), provider: 'groq', model }
    } catch (err: any) {
      console.error(`[ai-llm] Groq error (${model}):`, err?.message || err)
      return null
    }
  }
  return null
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<LLMResult | null> {
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
        console.error(`[ai-llm] Gemini ${res.status} (${model}): ${errBody.substring(0, 200)}`)
        if (res.status === 404 || res.status === 400) continue
        return null
      }

      const data = await res.json()
      const text: string | undefined = data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text || '')
        .join('')
      if (!text || !text.trim()) {
        console.error(`[ai-llm] Gemini returned empty content (${model})`)
        continue
      }
      return { text: text.trim(), provider: 'gemini', model }
    } catch (err: any) {
      console.error(`[ai-llm] Gemini error (${model}):`, err?.message || err)
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
