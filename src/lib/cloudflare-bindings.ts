/**
 * Cloudflare Worker Bindings — Central Hub
 *
 * Bindings available:
 * - env.ASSETS          : Static assets (OpenNext)
 * - env.IMAGES          : Cloudflare Images
 * - env.luxtradee_kv    : KV Namespace — shared cache
 * - env.R2              : R2 Bucket — DISABLED (error 10042)
 * - env.ai_luxtrade     : Workers AI — LLM, embeddings
 * - env.ai_run          : Browser Rendering — PDF, screenshots
 * - env.queue           : Queue Producer — background jobs
 * - env.RATE_LIMITER    : (via CF Rate Limiting API)
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

// R2 types kept for future re-enable (error 10042)
// declare abstract class CFR2Bucket { ... }

declare abstract class CFAi {
  abstract run(model: string, inputs: any, options?: any): Promise<any>
}

declare abstract class CFVectorizeIndex {
  abstract query(vector: number[], options?: { topK?: number; namespace?: string; returnMetadata?: boolean; returnValues?: boolean }): Promise<{ matches: Array<{ id: string; score: number; values?: number[]; metadata?: Record<string, string> }> }>
  abstract upsert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, string>; namespace?: string }>): Promise<void>
  abstract deleteByIds(ids: string[]): Promise<void>
}

// R2 interfaces kept for future re-enable (error 10042)
// interface R2Object { ... }
// interface R2ObjectBody extends R2Object { ... }
// interface R2Objects { ... }

// ─── Exports ──────────────────────────────────────────────────────────────────

export type { CFFetcher as Fetcher, CFKVNamespace as KVNamespace, CFAi as Ai, CFVectorizeIndex as VectorizeIndex }
// R2Bucket export disabled (error 10042)

export interface CloudflareBindings {
  ASSETS?: CFFetcher
  IMAGES?: CFFetcher
  luxtradee_kv?: CFKVNamespace  // KV Namespace binding
  // R2?: any  // R2 disabled (error 10042, not provisioned)
  ai_luxtrade?: CFAi            // Workers AI binding
  ai_run?: any                  // Browser Rendering binding
  queue?: any                   // Queue Producer binding
  VECTORIZE_INDEX?: CFVectorizeIndex
  RATE_LIMITER?: any
}

// ─── Get Environment ─────────────────────────────────────────────────────────

/**
 * Get Cloudflare env with bindings.
 *
 * In OpenNext/CF Workers, the official way to access bindings is via
 * getCloudflareContext() from @opennextjs/cloudflare, which uses
 * AsyncLocalStorage to store the env from the worker fetch handler.
 *
 * The old approach of (request as any).env does NOT work in OpenNext
 * because the Request object is recreated by Next.js middleware and
 * loses the .env property attached by the CF fetch handler.
 */
export async function getCloudflareEnv(): Promise<CloudflareBindings> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    // Try async variant first (more reliable in some OpenNext versions)
    try {
      const ctx = await getCloudflareContext({ async: true });
      if (ctx?.env) return ctx.env as CloudflareBindings;
    } catch {}
    // Fallback to sync variant
    const ctx = getCloudflareContext();
    return (ctx?.env ?? {}) as CloudflareBindings;
  } catch {
    // @opennextjs/cloudflare not available (local dev without wrangler)
    return {} as CloudflareBindings;
  }
}

/** Known placeholder patterns that should NOT be treated as real API keys */
const PLACEHOLDER_PATTERNS = [
  'your_', 'xxx', 'sk-or-', 'sk-your', 'hf_your',
  're_xxxxxxxxxx',
]

function isPlaceholderEnvVar(value: string): boolean {
  if (!value || value.length < 4) return true
  const lower = value.toLowerCase()
  return PLACEHOLDER_PATTERNS.some(p => lower.startsWith(p))
}

/**
 * Get an environment variable from Cloudflare Workers env (secrets + vars).
 * This is the centralized way to read API keys and other env vars in CF Workers.
 *
 * Resolution order (CF Workers production):
 *  1. getCloudflareContext().env[key]  — the canonical source for CF secrets/vars
 *  2. process.env[key]                 — fallback (OpenNext may populate this)
 *
 * Resolution order (local dev):
 *  1. process.env[key]                 — set via .dev.vars or shell env
 *  2. getCloudflareContext().env[key]  — works if wrangler dev is proxying
 */
export async function getEnvVar(key: string): Promise<string> {
  // 1. Try CF Workers env via getCloudflareContext (PRIMARY for production)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');

    // Try async variant first
    try {
      const ctx = await getCloudflareContext({ async: true });
      if (ctx?.env) {
        const val = (ctx.env as any)[key];
        if (val != null) {
          const s = typeof val === 'string' ? val : String(val);
          if (s && s !== '[object Object]' && !isPlaceholderEnvVar(s)) {
            console.log(`[getEnvVar] ${key} found in CF ctx.env (async), ${s.length} chars`);
            return s;
          }
          if (s && isPlaceholderEnvVar(s)) {
            console.warn(`[getEnvVar] ${key} in CF ctx.env (async) looks like placeholder: "${s.substring(0, 12)}..."`);
          }
        }
      }
    } catch {}

    // Sync variant fallback
    try {
      const ctx = getCloudflareContext();
      if (ctx?.env) {
        const val = (ctx.env as any)[key];
        if (val != null) {
          const s = typeof val === 'string' ? val : String(val);
          if (s && s !== '[object Object]' && !isPlaceholderEnvVar(s)) {
            console.log(`[getEnvVar] ${key} found in CF ctx.env (sync), ${s.length} chars`);
            return s;
          }
        }
      }
    } catch {}
  } catch (importErr: any) {
    console.info(`[getEnvVar] @opennextjs/cloudflare not available: ${importErr?.message || importErr}`);
  }

  // 2. Try process.env (works in local dev and when OpenNext populates it)
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.length > 0 && !isPlaceholderEnvVar(fromProcess)) {
    console.log(`[getEnvVar] ${key} found in process.env, ${fromProcess.length} chars`);
    return fromProcess;
  }

  console.warn(`[getEnvVar] ${key} NOT FOUND in any source`);
  return '';
}

/** Shorthand: get typed bindings */
export async function getBindings(): Promise<CloudflareBindings> {
  return getCloudflareEnv()
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
  if (!env?.ai_luxtrade) throw new Error('Workers AI binding not configured')

  const response = await env.ai_luxtrade.run(model, { prompt, max_tokens: 512 })
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
  if (!env?.ai_luxtrade) throw new Error('Workers AI binding not configured')

  const response = await env.ai_luxtrade.run(model, { text })
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
