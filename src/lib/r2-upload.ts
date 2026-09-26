/**
 * R2 Upload Utility — DISABLED (error 10042, R2 not provisioned)
 *
 * All R2 functions are stubbed to return safe fallbacks.
 * File uploads will fall back to# to Supabase Storage or return errors.
 *
 * To re-enable R2:
 * 1. Uncomment R2 binding in wrangler.toml
 * 2. Add R2 back to CloudflareBindings interface
 * 3. Replace this file with the original r2-upload.ts implementation
 */

import { getCloudflareEnv } from './cloudflare-bindings'

export interface R2UploadOptions {
  folder?: string
  filename?: string
  contentType?: string
  cacheControl?: string
  maxSize?: number
}

export interface R2UploadResult {
  success: boolean
  key: string
  url: string
  size: number
  type: string
}

/**
 * Upload a file — R2 DISABLED, always throws to trigger Supabase fallback.
 */
export async function uploadToR2(
  request: Request,
  file: File,
  userId: string,
  options: R2UploadOptions = {}
): Promise<R2UploadResult> {
  // R2 is disabled (error 10042) — throw to let caller fall back to Supabase Storage
  throw new Error('R2 storage is currently disabled. Use Supabase Storage fallback.')
}

/**
 * Get a file from R2 — DISABLED, always returns null.
 */
export async function getFromR2(
  request: Request,
  key: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  // R2 is disabled (error 10042)
  return null
}

/**
 * Delete a file from R2 — DISABLED, always returns false.
 */
export async function deleteFromR2(
  request: Request,
  key: string
): Promise<boolean> {
  // R2 is disabled (error 10042)
  return false
}

/**
 * List files in R2 — DISABLED, always returns empty array.
 */
export async function listR2Files(
  request: Request,
  prefix: string,
  limit: number = 50
): Promise<string[]> {
  // R2 is disabled (error 10042)
  return []
}
