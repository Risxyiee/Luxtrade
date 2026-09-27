import { NextRequest, NextResponse } from 'next/server'

/**
 * APK Download API Route
 *
 * R2 is disabled (error 10042). APK is served as a static redirect
 * to the file in /public/ directory (local dev) or via Cloudflare Images/CDN (prod).
 */
export async function GET(request: NextRequest) {
  // Redirect to the static APK file in /public/
  return NextResponse.redirect(new URL('/LuxTradee-v1.1.0-debug.apk', request.url))
}
