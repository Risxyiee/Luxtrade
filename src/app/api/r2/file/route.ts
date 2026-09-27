import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/r2/file?key=<key>
 * 
 * R2 is disabled (error 10042). Returns 503 to indicate service unavailable.
 * To re-enable: uncomment R2 binding in wrangler.toml and restore r2-upload.ts
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'File storage is temporarily unavailable. R2 is disabled.' },
    { status: 503 }
  )
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { error: 'File storage is temporarily unavailable. R2 is disabled.' },
    { status: 503 }
  )
}
