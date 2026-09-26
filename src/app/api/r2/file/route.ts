import { NextRequest, NextResponse } from 'next/server'
import { getFromR2 } from '@/lib/r2-upload'

/**
 * GET /api/r2/file?key=<key>
 * Proxy file from R2 bucket (fallback if no public R2 URL)
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')

  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
  }

  // Prevent path traversal
  if (key.includes('..')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const result = await getFromR2(request, key)

  if (!result) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return new NextResponse(result.data, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': `inline`,
    },
  })
}
