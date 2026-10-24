import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * APK Download API Route
 *
 * Legacy alias → redirect ke file APK statis (/luxtradee.apk) yang di-serve
 * sebagai Workers static asset via CF CDN (~1,5 MB, signed dengan keystore repo).
 * File besar tidak dibaca lewat fs (Workers tidak punya fs) — cukup redirect.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/luxtradee.apk', request.url), 302)
}
