/**
 * Gemini API client for LuxTradee PRO features
 * Uses Google's official @google/generative-ai SDK
 * Free tier: 15 RPM, 1M tokens/day
 */

import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult, Part } from '@google/generative-ai'

/**
 * Get Gemini API key — works on both Node.js and Cloudflare Workers.
 *
 * Resolution order:
 *  1. process.env.GEMINI_API_KEY (works in local dev + when OpenNext populates it)
 *  2. CF Workers ctx.env.GEMINI_API_KEY (for secrets set via `wrangler secret put`)
 *
 * The key is cached per-request to avoid repeated async lookups.
 */
let _cachedKey: string | null = null

async function getApiKeyAsync(): Promise<string> {
  if (_cachedKey !== null) return _cachedKey

  // 1. Try process.env first (fastest, works in local dev)
  if (process.env.GEMINI_API_KEY) {
    _cachedKey = process.env.GEMINI_API_KEY
    return _cachedKey
  }

  // 2. Try CF Workers env (secrets set via wrangler secret put)
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as any)[sym]
    if (ctx?.env?.GEMINI_API_KEY) {
      _cachedKey = ctx.env.GEMINI_API_KEY
      return _cachedKey
    }
  } catch {}

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    try {
      const ctx = await getCloudflareContext({ async: true })
      if (ctx?.env?.GEMINI_API_KEY) {
        _cachedKey = ctx.env.GEMINI_API_KEY
        return _cachedKey
      }
    } catch {}
    try {
      const ctx = getCloudflareContext()
      if (ctx?.env?.GEMINI_API_KEY) {
        _cachedKey = ctx.env.GEMINI_API_KEY
        return _cachedKey
      }
    } catch {}
  } catch {}

  _cachedKey = ''
  return _cachedKey
}

/** Sync check — only checks process.env (fast, used by isGeminiAvailable) */
function getApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  // Also try CF Workers globalThis cache (populated by getApiKeyAsync)
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as any)[sym]
    if (ctx?.env?.GEMINI_API_KEY) return ctx.env.GEMINI_API_KEY
  } catch {}
  return _cachedKey || ''
}

async function getGenerativeAI(): Promise<GoogleGenerativeAI> {
  const key = await getApiKeyAsync()
  if (!key) throw new Error('GEMINI_API_KEY not configured — set it via wrangler secret put or .env.local')
  // Reset cache for next request (stateless worker isolates)
  _cachedKey = null
  return new GoogleGenerativeAI(key)
}

export interface GeminiMessage {
  role: 'user' | 'model'
  parts: Part[]
}

export interface GeminiResponse {
  text: string
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export interface GeminiVisionPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string // base64
  }
}

/**
 * Send a chat completion request to Gemini
 */
export async function geminiChat(
  messages: GeminiMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
    systemInstruction?: string
    timeoutMs?: number
  }
): Promise<GeminiResponse> {
  const genAI = await getGenerativeAI()
  const modelName = options?.model || 'gemini-2.5-flash'
  const timeoutMs = options?.timeoutMs || 45000 // Default 45s timeout

  // Initialize the model with correct identifier (SDK handles "models/" prefix automatically)
  const model: GenerativeModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: options?.systemInstruction,
  })

  // Build the content array from messages - using 'user' and 'model' role strings
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? ('user' as const) : ('model' as const),
    parts: msg.parts,
  }))

  // Add timeout wrapper
  const timeoutPromise = new Promise<GeminiResponse>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  )

  const resultPromise = (async () => {
    const result: GenerateContentResult = await model.generateContent({
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    })

    const text = result.response.text() || ''

    return {
      text,
      usageMetadata: result.response.usageMetadata as any,
    }
  })()

  try {
    return await Promise.race([resultPromise, timeoutPromise])
  } catch (error) {
    if (error instanceof Error && error.message === 'Request timeout') {
      console.error(`[geminiChat] Timeout after ${timeoutMs}ms`)
      throw new Error(`AI request timed out after ${timeoutMs}ms. Please try again.`)
    }
    throw error
  }
}

/**
 * Simple single-prompt Gemini call (convenience wrapper)
 */
export async function geminiPrompt(
  prompt: string,
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
    systemInstruction?: string
    timeoutMs?: number
  }
): Promise<string> {
  const result = await geminiChat(
    [{ role: 'user', parts: [{ text: prompt }] }],
    { ...options }
  )
  return result.text
}

/**
 * Gemini vision call — analyze an image with text prompt
 * Uses correct inlineData structure for multimodal prompts
 */
export async function geminiVision(
  prompt: string,
  imageBase64: string,
  mimeType: string = 'image/png',
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
    systemInstruction?: string
    timeoutMs?: number
  }
): Promise<string> {
  const genAI = await getGenerativeAI()
  const modelName = options?.model || 'gemini-2.5-flash'
  const timeoutMs = options?.timeoutMs || 60000 // Default 60s timeout for vision

  // Initialize the model with correct identifier (SDK handles "models/" prefix automatically)
  const model: GenerativeModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: options?.systemInstruction,
  })

  // Build content with text and image using correct inlineData structure
  const parts: Part[] = [
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      }
    }
  ]

  // Add timeout wrapper
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  )

  const resultPromise = (async () => {
    const result: GenerateContentResult = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: options?.temperature ?? 0.4,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    })

    return result.response.text() || ''
  })()

  try {
    return await Promise.race([resultPromise, timeoutPromise])
  } catch (error) {
    if (error instanceof Error && error.message === 'Request timeout') {
      console.error(`[geminiVision] Timeout after ${timeoutMs}ms`)
      throw new Error(`AI vision request timed out after ${timeoutMs}ms. Please try again.`)
    }
    throw error
  }
}

/**
 * Check if Gemini API is configured (sync check — fast path for UI gating).
 * For the actual AI call, getApiKeyAsync() is used which also checks CF Workers env.
 */
export function isGeminiAvailable(): boolean {
  return !!getApiKey()
}

/**
 * Async check — more thorough, checks CF Workers env too.
 * Use in API route handlers where async is acceptable.
 */
export async function isGeminiAvailableAsync(): Promise<boolean> {
  const key = await getApiKeyAsync()
  _cachedKey = null // Reset for next request
  return !!key
}