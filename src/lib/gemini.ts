/**
 * Gemini API client for LuxTrade PRO features
 * Uses Google's official @google/generative-ai SDK
 * Free tier: 15 RPM, 1M tokens/day
 */

import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult, Part } from '@google/generative-ai'

function getApiKey(): string {
  return process.env.GEMINI_API_KEY || ''
}

function getGenerativeAI(): GoogleGenerativeAI {
  const key = getApiKey()
  if (!key) throw new Error('GEMINI_API_KEY not configured')
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
  }
): Promise<GeminiResponse> {
  const genAI = getGenerativeAI()
  const modelName = options?.model || 'gemini-1.5-flash'

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
  }
): Promise<string> {
  const genAI = getGenerativeAI()
  const modelName = options?.model || 'gemini-1.5-flash'

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

  const result: GenerateContentResult = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: options?.temperature ?? 0.4,
      maxOutputTokens: options?.maxTokens ?? 4096,
    },
  })

  return result.response.text() || ''
}

/**
 * Check if Gemini API is configured
 */
export function isGeminiAvailable(): boolean {
  return !!getApiKey()
}