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
    const env = ctx?.env as Record<string, string | undefined> | undefined
    if (env?.GEMINI_API_KEY) {
      _cachedKey = env.GEMINI_API_KEY
      return _cachedKey
    }
  } catch {}

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    try {
      const ctx = await getCloudflareContext({ async: true })
      const env = ctx?.env as Record<string, string | undefined> | undefined
      if (env?.GEMINI_API_KEY) {
        _cachedKey = env.GEMINI_API_KEY
        return _cachedKey
      }
    } catch {}
    try {
      const ctx = getCloudflareContext()
      const env = ctx?.env as Record<string, string | undefined> | undefined
      if (env?.GEMINI_API_KEY) {
        _cachedKey = env.GEMINI_API_KEY
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
    const env = ctx?.env as Record<string, string | undefined> | undefined
    if (env?.GEMINI_API_KEY) return env.GEMINI_API_KEY
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

export interface GeminiCallOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemInstruction?: string
  timeoutMs?: number
  /** Force JSON output (Gemini responseMimeType) — dramatically reduces JSON parse failures */
  responseMimeType?: 'application/json' | 'text/plain'
  /**
   * Thinking budget for gemini-2.5-* models (only applied to 2.5; older models ignore/error).
   * CRITICAL: 2.5-flash has thinking ON by default and thinking tokens count against
   * maxOutputTokens — with a 2048 budget the visible text can be truncated to empty,
   * which produced the "auto-journal tidak mengembalikan JSON" failures.
   */
  thinkingBudget?: number
  /**
   * FASE 3 — signal eksternal (opsional). Bila dipanggil: request SDK
   * DIBATALKAN sungguhan (fetch di-abort), bukan sekadar berhenti
   * menunggu seperti Promise.race. Dipakai caller yang punya deadline
   * lebih ketat dari timeoutMs (mis. cron 120 dtk).
   */
  signal?: AbortSignal
}

/**
 * FASE 3 — deteksi error hasil pembatalan (AbortSignal).
 * Menangkap DOMException 'AbortError' (Workers/fetch) maupun pesan
 * bawaan SDK/fetch yang beragam ("This operation was aborted", dll).
 */
function isAbortLike(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const e = error as { name?: string; message?: string }
    if (e.name === 'AbortError' || e.name === 'TimeoutError') return true
    if (typeof e.message === 'string' && /abort/i.test(e.message)) return true
  }
  return false
}

/**
 * FASE 3 — gabungkan signal eksternal + timeout internal jadi SATU
 * AbortController. Menghindari AbortSignal.any (belum ada di semua
 * runtime) dengan listener manual { once: true }.
 * Return { signal, dispose } — dispose HARUS dipanggil di finally agar
 * listener eksternal tidak bocor.
 */
function createCombinedAbortSignal(
  timeoutMs: number,
  external?: AbortSignal
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', onExternalAbort, { once: true })
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId)
      if (external) external.removeEventListener('abort', onExternalAbort)
    },
  }
}

/** Build generationConfig; thinkingConfig is passed through (SDK serializes unknown fields). */
function buildGenerationConfig(modelName: string, options?: GeminiCallOptions, defaultTokens = 2048): Record<string, unknown> {
  const genConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.7,
    maxOutputTokens: options?.maxTokens ?? defaultTokens,
  }
  if (options?.responseMimeType) genConfig.responseMimeType = options.responseMimeType
  if (options?.thinkingBudget !== undefined && modelName.startsWith('gemini-2.5')) {
    // thinkingConfig is not in the legacy SDK types yet, but the SDK JSON.stringifies
    // the whole request so the field reaches the API (verified in dist/index.js).
    genConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget }
  }
  return genConfig
}

/**
 * Send a chat completion request to Gemini
 */
export async function geminiChat(
  messages: GeminiMessage[],
  options?: GeminiCallOptions
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

  // FASE 3: AbortSignal asli — saat timeout, request SDK DIBATALKAN
  // sungguhan (socket fetch ditutup). Dulu Promise.race hanya berhenti
  // menunggu; request tetap jalan sampai selesai → boros resource di
  // CF Workers & Gemini quota tetap terpakai.
  const abort = createCombinedAbortSignal(timeoutMs, options?.signal)

  try {
    const result: GenerateContentResult = await model.generateContent(
      {
        contents,
        generationConfig: buildGenerationConfig(modelName, options, 2048) as any,
      },
      { signal: abort.signal }
    )

    const text = result.response.text() || ''

    return {
      text,
      usageMetadata: result.response.usageMetadata as any,
    }
  } catch (error) {
    if (abort.signal.aborted || isAbortLike(error)) {
      console.error(`[geminiChat] Timeout/abort after ${timeoutMs}ms — request dibatalkan`)
      throw new Error(`AI request timed out after ${timeoutMs}ms. Please try again.`)
    }
    throw error
  } finally {
    abort.dispose()
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
  options?: GeminiCallOptions
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

  // FASE 3: AbortSignal asli (lihat geminiChat) — vision call dibatalkan
  // sungguhan saat timeout, tidak menggantung di background.
  const abort = createCombinedAbortSignal(timeoutMs, options?.signal)

  try {
    const result: GenerateContentResult = await model.generateContent(
      {
        contents: [{ role: 'user', parts }],
        generationConfig: buildGenerationConfig(modelName, options, 4096) as any,
      },
      { signal: abort.signal }
    )

    return result.response.text() || ''
  } catch (error) {
    if (abort.signal.aborted || isAbortLike(error)) {
      console.error(`[geminiVision] Timeout/abort after ${timeoutMs}ms — request dibatalkan`)
      throw new Error(`AI vision request timed out after ${timeoutMs}ms. Please try again.`)
    }
    throw error
  } finally {
    abort.dispose()
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

/**
 * Task 32b — resolved API key untuk panggilan REST langsung (ListModels
 * discovery di auto-journal): mencakup process.env + CF Workers env.
 */
export async function getGeminiApiKeyResolved(): Promise<string> {
  const key = await getApiKeyAsync()
  _cachedKey = null // Reset for next request (stateless worker isolates)
  return key || ''
}