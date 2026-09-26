/**
 * Vectorize Utility — Semantic search for trade journals
 *
 * Enables "find trades similar to this" and RAG on journal entries.
 * Uses Workers AI for embeddings + Vectorize for storage & retrieval.
 *
 * Setup:
 * 1. wrangler vectorize create "luxtradee-journals" --dimensions=768 --metric=cosine
 * 2. Uncomment VECTORIZE_INDEX in wrangler.toml
 */

import { getCloudflareEnv, type CloudflareBindings } from './cloudflare-bindings'
import { cfEmbed } from './cf-ai'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VectorizeEntry {
  id: string
  values: number[]
  metadata?: Record<string, string>
}

export interface VectorizeSearchResult {
  id: string
  score: number
  metadata?: Record<string, string>
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * Insert a trade/journal entry into the vector index.
 */
export async function indexTradeEntry(
  request: Request,
  id: string,
  text: string,
  metadata?: Record<string, string>
): Promise<boolean> {
  const env = getCloudflareEnv(request)
  if (!env?.VECTORIZE_INDEX) return false

  const values = await cfEmbed(request, text)
  if (!values) return false

  try {
    await env.VECTORIZE_INDEX.upsert([{
      id,
      values,
      metadata,
    }])
    return true
  } catch (error) {
    console.error('[Vectorize] Insert error:', error)
    return false
  }
}

/**
 * Search for similar trade/journal entries.
 * Returns top-K most similar entries with scores.
 */
export async function searchSimilarTrades(
  request: Request,
  query: string,
  topK: number = 5,
  namespace?: string
): Promise<VectorizeSearchResult[]> {
  const env = getCloudflareEnv(request)
  if (!env?.VECTORIZE_INDEX) return []

  const queryVector = await cfEmbed(request, query)
  if (!queryVector) return []

  try {
    const results = await env.VECTORIZE_INDEX.query(queryVector, {
      topK,
      namespace,
      returnMetadata: true,
    })

    return results.matches.map((m: any) => ({
      id: m.id,
      score: m.score,
      metadata: m.metadata,
    }))
  } catch (error) {
    console.error('[Vectorize] Search error:', error)
    return []
  }
}

/**
 * Delete entries from the vector index by ID.
 */
export async function deleteVectorEntries(
  request: Request,
  ids: string[]
): Promise<boolean> {
  const env = getCloudflareEnv(request)
  if (!env?.VECTORIZE_INDEX) return false

  try {
    await env.VECTORIZE_INDEX.deleteByIds(ids)
    return true
  } catch (error) {
    console.error('[Vectorize] Delete error:', error)
    return false
  }
}
