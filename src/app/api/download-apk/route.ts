import { NextRequest, NextResponse } from 'next/server'

/**
 * APK Download API Route
 * 
 * In production (Cloudflare Workers), the APK lives in R2 bucket "luxtradee-uploads"
 * In development, it's served from the local public/ directory via redirect
 */
export async function GET(request: NextRequest) {
  // Check if we're in a Cloudflare Workers environment with R2 binding
  const env = (request as any).env
  
  if (env?.R2) {
    try {
      // Serve from R2 bucket
      const object = await env.R2.get('LuxTradee-v1.1.0-debug.apk')
      if (object) {
        return new NextResponse(object.body, {
          headers: {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': 'attachment; filename="LuxTradee-v1.1.0-debug.apk"',
            'Content-Length': object.size.toString(),
            'Cache-Control': 'public, max-age=86400',
          },
        })
      }
    } catch (e) {
      console.error('R2 fetch failed, falling back:', e)
    }
  }

  // Fallback: redirect to static file (works in dev, or if R2 is not configured)
  return NextResponse.redirect(new URL('/LuxTradee-v1.1.0-debug.apk', request.url))
}
