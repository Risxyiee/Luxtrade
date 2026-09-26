/**
 * Workers AI Convenience Wrapper
 *
 * Provides easy access to CF Workers AI for:
 * - Text generation (sentiment, categorization, summarization)
 * - Embeddings (for Vectorize semantic search)
 * - Image classification
 *
 * Falls back to external AI APIs if binding not available.
 */

import { getCloudflareEnv, type CloudflareBindings } from './cloudflare-bindings'

// ─── Models ───────────────────────────────────────────────────────────────────

export const CF_AI_MODELS = {
  // Text generation
  chat: '@cf/meta/llama-3.1-8b-instruct',
  chatFast: '@cf/meta/llama-3.1-8b-instruct-fp-8',
  // Embeddings
  embedding: '@cf/baai/bge-base-en-v1.5',
  embeddingLarge: '@cf/baai/bge-large-en-v1.5',
  // Image classification
  imageClassify: '@cf/meta/resnet-50-image-classification',
  // Sentiment (text classification)
  sentiment: '@cf/meta/distilbert-sentiment',
  // Translation
  translate: '@cf/meta/m2m100-1.2B',
} as const

// ─── Text Generation ─────────────────────────────────────────────────────────

export interface CFChatOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

/**
 * Generate text using Workers AI (chat completion style).
 */
export async function cfChat(
  request: Request,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: CFChatOptions = {}
): Promise<string | null> {
  const env = getCloudflareEnv(request)
  if (!env?.AI) return null

  const model = options.model ?? CF_AI_MODELS.chat
  const maxTokens = options.maxTokens ?? 512
  const temperature = options.temperature ?? 0.7

  try {
    const response = await env.AI.run(model, {
      messages,
      max_tokens: maxTokens,
      temperature,
    })

    return response.response ?? response.output ?? null
  } catch (error) {
    console.error('[CF AI] Chat error:', error)
    return null
  }
}

// ─── Sentiment Analysis ──────────────────────────────────────────────────────

export interface SentimentResult {
  label: 'positive' | 'negative' | 'neutral'
  score: number
}

/**
 * Analyze sentiment of text using Workers AI.
 * Useful for: trade journal mood detection, news sentiment.
 */
export async function cfSentiment(
  request: Request,
  text: string
): Promise<SentimentResult | null> {
  const env = getCloudflareEnv(request)
  if (!env?.AI) return null

  try {
    const response = await env.AI.run(CF_AI_MODELS.sentiment, { text })
    const results = response.results ?? response

    if (Array.isArray(results) && results.length > 0) {
      const top = results[0]
      return {
        label: top.label?.toLowerCase() ?? 'neutral',
        score: top.score ?? 0.5,
      }
    }

    return null
  } catch (error) {
    console.error('[CF AI] Sentiment error:', error)
    return null
  }
}

// ─── Embeddings ──────────────────────────────────────────────────────────────

/**
 * Create embedding vector for text.
 * Used for Vectorize semantic search on trade journals.
 */
export async function cfEmbed(
  request: Request,
  text: string,
  model: string = CF_AI_MODELS.embedding
): Promise<number[] | null> {
  const env = getCloudflareEnv(request)
  if (!env?.AI) return null

  try {
    const response = await env.AI.run(model, { text })
    return response.data ?? response.embedding ?? null
  } catch (error) {
    console.error('[CF AI] Embed error:', error)
    return null
  }
}

// ─── Image Classification ────────────────────────────────────────────────────

/**
 * Classify an image using Workers AI.
 * Useful for: detecting trade chart screenshots vs non-chart images.
 */
export async function cfClassifyImage(
  request: Request,
  imageBuffer: ArrayBuffer
): Promise<Array<{ label: string; score: number }> | null> {
  const env = getCloudflareEnv(request)
  if (!env?.AI) return null

  try {
    const response = await env.AI.run(CF_AI_MODELS.imageClassify, {
      image: Array.from(new Uint8Array(imageBuffer)),
    })

    return response.results ?? response
  } catch (error) {
    console.error('[CF AI] Image classify error:', error)
    return null
  }
}
