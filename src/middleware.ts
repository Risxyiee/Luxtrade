import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/about', '/blog', '/contact', '/faq', '/terms', '/privacy', '/disclaimer', '/refund-policy', '/not-found', '/upgrade']
const ADMIN_EMAILS = ['luxtradee@gmail.com']

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

// Force dynamic untuk middleware
export const dynamic = 'force-dynamic'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  console.log('[Middleware] Processing request:', { pathname })

  // Allow auth pages
  if (pathname.startsWith('/auth/')) {
    console.log('[Middleware] Auth path - allowing')
    return NextResponse.next()
  }

  // Allow API routes (they handle their own auth)
  if (pathname.startsWith('/api/')) {
    console.log('[Middleware] API path - allowing')
    return NextResponse.next()
  }

  // Allow public static pages
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    console.log('[Middleware] Public path - allowing')
    return NextResponse.next()
  }

  // Admin-only paths — require login + admin email
  const adminPaths = ['/dashboard/admin', '/admin-email', '/admin-secret', '/admin-subscriptions']
  const isAdminPath = adminPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  // Protected paths — require login
  const protectedPaths = ['/dashboard', '/settings']
  const isProtectedPath = protectedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isAdminPath || isProtectedPath) {
    console.log('[Middleware] Protected/Admin path - checking auth')

    const response = NextResponse.next()

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Middleware] Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      })
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            const cookies = request.cookies.getAll()
            console.log('[Middleware] Cookies:', cookies.map(c => ({ name: c.name, hasValue: !!c.value, len: c.value?.length })))
            return cookies
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name: ckName, value: ckValue }) => {
              request.cookies.set(ckName, ckValue)
              response.cookies.set(ckName, ckValue)
            })
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    console.log('[Middleware] Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      error: error?.message,
    })

    if (!user) {
      console.log('[Middleware] No user - redirecting to login')
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // Admin paths: check if user is admin
    if (isAdminPath) {
      const userEmail = user.email?.toLowerCase().trim() || ''
      const isAuthorized = ADMIN_EMAILS.some(adminEmail =>
        adminEmail.toLowerCase().trim() === userEmail
      )

      console.log('[Middleware Admin Check]', {
        path: pathname,
        userEmail,
        ADMIN_EMAILS,
        isAuthorized,
        emailMatch: ADMIN_EMAILS.map(e => e.toLowerCase().trim() === userEmail)
      })

      if (!isAuthorized) {
        console.log('[Middleware] Admin access denied - redirecting to dashboard')
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }

      console.log('[Middleware] Admin access granted')
    }

    return response
  }

  console.log('[Middleware] Default - allowing')
  return NextResponse.next()
}
