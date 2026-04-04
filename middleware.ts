import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// NOTE: Supabase client-side auth stores session in localStorage, NOT cookies.
// Middleware cannot read localStorage, so we can't do proper server-side auth checks.
// Auth protection is handled by:
// 1. AuthContext (checks session on client)
// 2. Client-side redirects in pages

// This middleware is disabled for auth - it only handles other middleware tasks if needed
export function middleware(req: NextRequest) {
  // Let all requests through - auth is handled client-side
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match nothing for now - middleware disabled
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
}
