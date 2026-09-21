// @ts-nocheck
/**
 * Cloudflare Worker Bindings Helper
 *
 * Binding yang tersedia:
 * - env.MY_BROWSER: Browser Rendering Service (Puppeteer)
 * - env.RATE_LIMITER: Rate Limiter untuk proteksi API
 * - env.AI: Workers AI untuk LLM & embeddings
 * - env.VECTORIZE_INDEX: Vectorize Index untuk vector search & RAG
 * - env.IMAGES: Cloudflare Images
 * - env.ASSETS: Static assets
 */

// Type declarations for Cloudflare Workers bindings
declare class D1Database {}
declare class KVNamespace {}
declare class R2Bucket {}

/**
 * Get Cloudflare environment with bindings from Next.js request context
 * @param request - Next.js Request object
 * @returns Cloudflare env with bindings
 */
export function getCloudflareEnv(request: Request) {
  // In Cloudflare Workers, env is available via request.cf or passed from middleware
  // For OpenNext, bindings are attached to the request context
  return (request as any).env || process.env
}

/**
 * Helper untuk rate limiting API endpoints
 * @param env - Cloudflare environment
 * @param identifier - IP address, user ID, atau API key
 * @param limit - Maximum requests
 * @param window - Time window in seconds (default: 60)
 */
export async function checkRateLimit(
  env: any,
  identifier: string,
  limit: number = 100,
  window: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    if (!env.RATE_LIMITER) {
      console.warn('[RateLimit] RATE_LIMITER binding not configured, allowing all requests')
      return { allowed: true, remaining: limit, resetAt: Date.now() + window * 1000 }
    }

    const key = `rate_limit:${identifier}`
    const result = await env.RATE_LIMITER.limit({
      key,
      limit,
      window,
    })

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.resetAt,
    }
  } catch (error) {
    console.error('[RateLimit] Error:', error)
    // Fail open - allow request if rate limiter fails
    return { allowed: true, remaining: limit, resetAt: Date.now() + window * 1000 }
  }
}

/**
 * Helper untuk AI inference (LLM)
 * @param env - Cloudflare environment
 * @param prompt - Input prompt
 * @param model - Model name (default: @cf/meta/llama-3.1-8b-instruct)
 */
export async function runAIInference(
  env: any,
  prompt: string,
  model: string = '@cf/meta/llama-3.1-8b-instruct'
): Promise<{ response: string; tokens: number }> {
  if (!env.AI) {
    throw new Error('AI binding not configured')
  }

  try {
    const response = await env.AI.run(model, {
      prompt,
      max_tokens: 512,
    })

    return {
      response: response.response || response.output || response.text || '',
      tokens: response.tokens || response.input_tokens + (response.output_tokens || 0),
    }
  } catch (error) {
    console.error('[AI] Inference error:', error)
    throw new Error(`AI inference failed: ${error}`)
  }
}

/**
 * Helper untuk vector embeddings
 * @param env - Cloudflare environment
 * @param text - Text to embed
 * @param model - Model name (default: @cf/baai/bge-base-en-v1.5)
 */
export async function createEmbedding(
  env: any,
  text: string,
  model: string = '@cf/baai/bge-base-en-v1.5'
): Promise<number[]> {
  if (!env.AI) {
    throw new Error('AI binding not configured')
  }

  try {
    const response = await env.AI.run(model, {
      text,
    })

    return response.data || response.embedding || response.vector || []
  } catch (error) {
    console.error('[AI] Embedding error:', error)
    throw new Error(`Embedding creation failed: ${error}`)
  }
}

/**
 * Helper untuk vector search
 * @param env - Cloudflare environment
 * @param query - Query vector or text
 * @param topK - Number of results (default: 5)
 * @param namespace - Vectorize namespace
 */
export async function vectorSearch(
  env: any,
  query: number[] | string,
  topK: number = 5,
  namespace: string = 'default'
): Promise<Array<{ id: string; score: number; metadata?: any }>> {
  if (!env.VECTORIZE_INDEX) {
    throw new Error('VECTORIZE_INDEX binding not configured')
  }

  try {
    let vector: number[]

    // If query is text, create embedding first
    if (typeof query === 'string') {
      vector = await createEmbedding(env, query)
    } else {
      vector = query
    }

    const results = await env.VECTORIZE_INDEX.query(vector, {
      topK,
      namespace,
      returnMetadata: true,
    })

    return results.matches.map((match: any) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }))
  } catch (error) {
    console.error('[Vectorize] Search error:', error)
    throw new Error(`Vector search failed: ${error}`)
  }
}

/**
 * Helper untuk insert vector ke index
 * @param env - Cloudflare environment
 * @param vectors - Array of vectors to insert
 */
export async function insertVectors(
  env: any,
  vectors: Array<{
    id: string
    values: number[]
    metadata?: any
    namespace?: string
  }>
): Promise<void> {
  if (!env.VECTORIZE_INDEX) {
    throw new Error('VECTORIZE_INDEX binding not configured')
  }

  try {
    await env.VECTORIZE_INDEX.upsert(vectors)
  } catch (error) {
    console.error('[Vectorize] Insert error:', error)
    throw new Error(`Vector insert failed: ${error}`)
  }
}

/**
 * Type definitions for Cloudflare bindings
 */
export interface CloudflareBindings {
  MY_BROWSER?: any
  RATE_LIMITER?: any
  AI?: any
  VECTORIZE_INDEX?: any
  IMAGES?: any
  ASSETS?: any
  DB?: D1Database
  KV?: KVNamespace
  R2?: R2Bucket
}

/**
 * Get typed bindings from request
 */
export function getBindings(request: Request): CloudflareBindings {
  return getCloudflareEnv(request) as CloudflareBindings
}