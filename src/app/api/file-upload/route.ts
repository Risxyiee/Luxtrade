import { NextResponse } from 'next/server'

/**
 * ⚠️ DISABLED on Cloudflare Edge Runtime
 * 
 * Cloudflare Workers/Edge do not have a local filesystem.
 * Use Supabase Storage (src/lib/storage/signed-url) or Cloudflare R2 instead.
 * 
 * If you need file uploads on Cloudflare, use:
 * 1. Supabase Storage (recommended — already configured)
 * 2. Cloudflare R2 with presigned URLs
 * 3. A third-party service like UploadThing or Vercel Blob
 */
export async function POST() {
  return NextResponse.json(
    { 
      error: 'File upload is not available on this runtime.',
      hint: 'Use Supabase Storage (via /api/storage/signed-url) for file uploads on Cloudflare Pages.'
    },
    { status: 501 }
  )
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  )
}
