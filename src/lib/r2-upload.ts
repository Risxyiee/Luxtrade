/**
 * R2 Upload Utility — File uploads to Cloudflare R2
 *
 * Replaces Supabase Storage for trade screenshots, testimonial photos, etc.
 * Benefits: same network as CF Workers (faster), no egress fees, S3-compatible.
 *
 * Falls back to Supabase Storage if R2 binding not available.
 */

import { getCloudflareEnv, type CloudflareBindings } from './cloudflare-bindings'

export interface R2UploadOptions {
  /** Bucket subfolder (e.g., 'screenshots', 'testimonials') */
  folder?: string
  /** Custom filename (default: auto-generated) */
  filename?: string
  /** Content-Type header */
  contentType?: string
  /** Cache-Control header (default: 'public, max-age=86400') */
  cacheControl?: string
  /** Max file size in bytes (default: 10MB) */
  maxSize?: number
}

export interface R2UploadResult {
  success: boolean
  key: string
  url: string
  size: number
  type: string
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Upload a file to R2 bucket.
 * Returns the R2 key and a URL to access it via the public R2 URL or a custom domain.
 */
export async function uploadToR2(
  request: Request,
  file: File,
  userId: string,
  options: R2UploadOptions = {}
): Promise<R2UploadResult> {
  const env = getCloudflareEnv(request)
  const r2 = env.R2

  if (!r2) {
    throw new Error('R2 bucket binding not configured. Falling back to Supabase Storage.')
  }

  const maxSize = options.maxSize ?? 10 * 1024 * 1024

  // Validate file size
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB.`)
  }

  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP, GIF.`)
  }

  // Generate key (path in R2)
  const ext = file.name.split('.').pop() || 'jpg'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const folder = options.folder || 'uploads'
  const filename = options.filename || `${timestamp}-${random}.${ext}`
  const key = `${folder}/${userId}/${filename}`

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer()

  await r2.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: options.cacheControl ?? 'public, max-age=86400',
    },
    customMetadata: {
      userId,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  })

  // Build public URL
  // R2 public URL format: https://<bucket>.<account-id>.r2.dev/<key>
  // Or via custom domain: https://cdn.luxtradee.web.id/<key>
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''
  const url = publicUrl ? `${publicUrl}/${key}` : `/api/r2/file?key=${encodeURIComponent(key)}`

  return {
    success: true,
    key,
    url,
    size: file.size,
    type: file.type,
  }
}

/**
 * Get a file from R2 bucket.
 * Returns the file as an ArrayBuffer, or null if not found.
 */
export async function getFromR2(
  request: Request,
  key: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const env = getCloudflareEnv(request)
  const r2 = env.R2

  if (!r2) return null

  const object = await r2.get(key)
  if (!object) return null

  const data = await object.arrayBuffer()
  const contentType = object.httpMetadata?.contentType || 'application/octet-stream'

  return { data, contentType }
}

/**
 * Delete a file from R2 bucket.
 */
export async function deleteFromR2(
  request: Request,
  key: string
): Promise<boolean> {
  const env = getCloudflareEnv(request)
  const r2 = env.R2

  if (!r2) return false

  try {
    await r2.delete(key)
    return true
  } catch {
    return false
  }
}

/**
 * List files in R2 bucket for a user.
 */
export async function listR2Files(
  request: Request,
  prefix: string,
  limit: number = 50
): Promise<string[]> {
  const env = getCloudflareEnv(request)
  const r2 = env.R2

  if (!r2) return []

  try {
    const result = await r2.list({ prefix, limit })
    return result.objects.map((obj) => obj.key)
  } catch {
    return []
  }
}
