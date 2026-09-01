/**
 * Gemini API client for LuxTrade PRO features
 * Uses Google's Gemini API (free tier: 15 RPM, 1M tokens/day)
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

function getApiKey(): string {
  return process.env.GEMINI_API_KEY || ''
}

function getEndpoint(modelId: string = 'gemini-2.0-flash'): string {
  const key = getApiKey()
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  return `${GEMINI_API_URL}/${modelId}:generateContent?key=${key}`
}

export interface GeminiMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
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
  }
): Promise<GeminiResponse> {
  const model = options?.model || 'gemini-2.0-flash'
  const url = getEndpoint(model)

  const body: any = {
    contents: messages,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 2048,
    },
  }

  if (options?.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }]
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return {
    text,
    usageMetadata: data.usageMetadata,
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
  }
): Promise<string> {
  const result = await geminiChat(
    [{ role: 'user', parts: [{ text: prompt }] }],
    options
  )
  return result.text
}

/**
 * Gemini vision call — analyze an image with text prompt
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
  }
): Promise<string> {
  const model = options?.model || 'gemini-2.0-flash'
  const url = getEndpoint(model)

  const body: any = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } }
      ]
    }],
    generationConfig: {
      temperature: options?.temperature ?? 0.4,
      maxOutputTokens: options?.maxTokens ?? 4096,
    },
  }

  if (options?.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }]
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`Gemini Vision API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

/**
 * Check if Gemini API is configured
 */
export function isGeminiAvailable(): boolean {
  return !!getApiKey()
}
