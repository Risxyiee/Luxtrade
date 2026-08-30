import { NextResponse } from 'next/server'

/**
 * ⚠️ DISABLED on Cloudflare Edge Runtime
 * This endpoint reads files from the local filesystem which is not available on Edge.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Batch photo matching is not available on this runtime.' },
    { status: 501 }
  )
}
