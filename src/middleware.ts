import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/about', '/blog', '/contact', '/faq', '/terms', '/privacy', '/disclaimer', '/refund-policy', '/not-found', '/upgrade']

const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com']

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings',
    '/auth/:path*',
    '/admin-secret',
    '/admin-email',
    '/admin-subscriptions',
    '/admin-subscriptions/:path*',
  ],
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow auth pages
  if (pathname.startsWith('/auth/')) return NextResponse.next()

  // Allow API routes (they handle their own auth)
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Allow public static pages
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next()

  // Admin-only paths — require login + admin email
  const adminPaths = ['/dashboard/admin', '/admin-email', '/admin-secret', '/admin-subscriptions']
  const isAdminPath = adminPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  // Protected paths — require login
  const protectedPaths = ['/dashboard', '/settings']
  const isProtectedPath = protectedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isAdminPath || isProtectedPath) {
    const response = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name: ckName, value: ckValue }) => {
              request.cookies.set(ckName, ckValue)
              response.cookies.set(ckName, ckValue)
            })
          },
        },
      }
    )

    // Use then/catch pattern instead of async to keep it synchronous-return
    // compatible with Edge runtime middleware
    return supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        url.searchParams.set('redirect', pathname)
        return NextResponse.redirect(url)
      }

      // Admin paths: check if user is admin
      if (isAdminPath) {
        const userEmail = user.email?.toLowerCase() || ''
        if (!ADMIN_EMAILS.includes(userEmail)) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }
      }

      return response
    })
  }

  return NextResponse.next()
}
