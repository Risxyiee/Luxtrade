import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Public routes that don't require authentication
const publicRoutes = ['/login', '/signup', '/auth/callback', '/api/']

// Protected routes that require authentication
const protectedRoutes = ['/dashboard', '/trades', '/journal', '/analytics', '/settings']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // Skip middleware for API routes, static files, and auth callbacks
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return res
  }

  // Create Supabase client for middleware
  const supabase = createMiddlewareClient({ req, res })

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If user is NOT logged in and tries to access protected route
  if (!session && isProtectedRoute) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user IS logged in and tries to access public route (except /auth/callback)
  if (session && isPublicRoute && !pathname.includes('/auth/callback')) {
    // Redirect to dashboard instead of home to avoid loop
    if (pathname === '/login' || pathname === '/signup') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    // Match all paths except:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public folder
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
