import { NextResponse } from 'next/server'

/**
 * ⚠️ DISABLED on Cloudflare Edge Runtime
 * This endpoint reads files from the local filesystem which is not available on Edge.
 * To re-enable: refactor to fetch images from Supabase Storage using signed URLs.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Photo trade matching is not available on this runtime. Use Supabase Storage for file operations.' },
    { status: 501 }
  )
}
