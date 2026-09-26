/**
 * Cloudflare Worker Bindings — Central Hub
 *
 * Bindings available:
 * - env.ASSETS       : Static assets (OpenNext)
 * - env.IMAGES       : Cloudflare Images
 * - env.KV           : KV Namespace — shared cache
 * - env.R2           : R2 Bucket — file uploads
 * - env.AI           : Workers AI — LLM, embeddings
 * - env.MY_BROWSER   : Browser Rendering — PDF, screenshots
 * - env.RATE_LIMITER : (via CF Rate Limiting API)
 * - env.VECTORIZE_INDEX : Vectorize — semantic search (optional)
 */

// ─── Cloudflare Type Declarations ─────────────────────────────────────────────
// Minimal declarations for CF Worker bindings (avoids conflict with DOM types)

declare abstract class CFFetcher {
  abstract fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

declare abstract class CFKVNamespace {
  abstract get(key: string, type: 'text'): Promise<string | null>
  abstract get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>
  abstract put(key: string, value: string | ReadableStream | ArrayBuffer, options?: { expirationTtl?: number; expiration?: number; metadata?: any }): Promise<void>
  abstract delete(key: string): Promise<void>
  abstract list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string; expiration?: number; metadata?: any }>; list_complete: boolean; cursor?: string }>
}

declare abstract class CFR2Bucket {
  abstract get(key: string): Promise<R2ObjectBody | null>
  abstract put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array | string, options?: { httpMetadata?: { contentType?: string; cacheControl?: string; contentEncoding?: string; contentDisposition?: string }; customMetadata?: Record<string, string> }): Promise<R2Object>
  abstract delete(keys: string | string[]): Promise<void>
  abstract list(options?: { prefix?: string; limit?: number; cursor?: string; include?: ('httpMetadata' | 'customMetadata')[] }): Promise<R2Objects>
}

declare abstract class CFAi {
  abstract run(model: string, inputs: any, options?: any): Promise<any>
}

declare abstract class CFVectorizeIndex {
  abstract query(vector: number[], options?: { topK?: number; namespace?: string; returnMetadata?: boolean; returnValues?: boolean }): Promise<{ matches: Array<{ id: string; score: number; values?: number[]; metadata?: Record<string, string> }> }>
  abstract upsert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, string>; namespace?: string }>): Promise<void>
  abstract deleteByIds(ids: string[]): Promise<void>
}

interface R2Object {
  key: string
  size: number
  uploaded: Date
  httpMetadata?: { contentType?: string; cacheControl?: string; contentEncoding?: string; contentDisposition?: string }
  customMetadata?: Record<string, string>
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T>(): Promise<T>
}

interface R2Objects {
  objects: R2Object[]
  delimitedPrefixes: string[]
  truncated: boolean
  cursor?: string
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export type { CFFetcher as Fetcher, CFKVNamespace as KVNamespace, CFR2Bucket as R2Bucket, CFAi as Ai, CFVectorizeIndex as VectorizeIndex }

export interface CloudflareBindings {
  ASSETS?: CFFetcher
  IMAGES?: CFFetcher
  KV?: CFKVNamespace
  R2?: CFR2Bucket
  AI?: CFAi
  MY_BROWSER?: any  // Browser Rendering (Puppeteer-like)
  VECTORIZE_INDEX?: CFVectorizeIndex
  RATE_LIMITER?: any
}

// ─── Get Environment ─────────────────────────────────────────────────────────

/**
 * Get Cloudflare env with bindings from Next.js request context.
 * In OpenNext/CF Workers, bindings are on (request as any).env
 */
export function getCloudflareEnv(request: Request): CloudflareBindings {
  return (request as any).env ?? {}
}

/** Shorthand: get typed bindings from request */
export function getBindings(request: Request): CloudflareBindings {
  return getCloudflareEnv(request)
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

/**
 * Check rate limit via Cloudflare Rate Limiting API.
 * Falls back to allowing all if binding not configured.
 */
export async function checkRateLimit(
  env: CloudflareBindings | any,
  identifier: string,
  limit: number = 100,
  window: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    if (!env?.RATE_LIMITER) {
      return { allowed: true, remaining: limit, resetAt: Date.now() + window * 1000 }
    }

    const result = await env.RATE_LIMITER.limit({ key: identifier, limit, window })
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.resetAt,
    }
  } catch (error) {
    console.error('[CF RateLimit] Error:', error)
    return { allowed: true, remaining: limit, resetAt: Date.now() + window * 1000 }
  }
}

// ─── Workers AI ───────────────────────────────────────────────────────────────

/** Run LLM inference via Workers AI */
export async function runAIInference(
  env: CloudflareBindings | any,
  prompt: string,
  model: string = '@cf/meta/llama-3.1-8b-instruct'
): Promise<{ response: string; tokens: number }> {
  if (!env?.AI) throw new Error('Workers AI binding not configured')

  const response = await env.AI.run(model, { prompt, max_tokens: 512 })
  return {
    response: response.response || response.output || response.text || '',
    tokens: response.tokens ?? (response.input_tokens ?? 0) + (response.output_tokens ?? 0),
  }
}

/** Create text embedding via Workers AI */
export async function createEmbedding(
  env: CloudflareBindings | any,
  text: string,
  model: string = '@cf/baai/bge-base-en-v1.5'
): Promise<number[]> {
  if (!env?.AI) throw new Error('Workers AI binding not configured')

  const response = await env.AI.run(model, { text })
  return response.data ?? response.embedding ?? response.vector ?? []
}

// ─── Vectorize ────────────────────────────────────────────────────────────────

/** Search vectors in Vectorize index */
export async function vectorSearch(
  env: CloudflareBindings | any,
  query: number[] | string,
  topK: number = 5,
  namespace: string = 'default'
): Promise<Array<{ id: string; score: number; metadata?: Record<string, string> }>> {
  if (!env?.VECTORIZE_INDEX) throw new Error('VECTORIZE_INDEX binding not configured')

  const vector = typeof query === 'string' ? await createEmbedding(env, query) : query
  const results = await env.VECTORIZE_INDEX.query(vector, { topK, namespace, returnMetadata: true })

  return results.matches.map((m: any) => ({
    id: m.id,
    score: m.score,
    metadata: m.metadata,
  }))
}

/** Insert vectors into Vectorize index */
export async function insertVectors(
  env: CloudflareBindings | any,
  vectors: Array<{ id: string; values: number[]; metadata?: Record<string, string>; namespace?: string }>
): Promise<void> {
  if (!env?.VECTORIZE_INDEX) throw new Error('VECTORIZE_INDEX binding not configured')
  await env.VECTORIZE_INDEX.upsert(vectors)
}
