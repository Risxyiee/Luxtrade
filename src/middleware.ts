import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/about', '/blog', '/contact', '/faq', '/terms', '/privacy', '/disclaimer', '/refund-policy', '/not-found', '/upgrade']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow auth pages
  if (pathname.startsWith('/auth/')) return NextResponse.next()
  
  // Allow API routes (they handle their own auth)
  if (pathname.startsWith('/api/')) return NextResponse.next()
  
  // Allow public static pages
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next()
  
  // For dashboard, settings, and admin pages — check session
  const protectedPaths = ['/dashboard', '/settings', '/admin-secret', '/admin-email', '/admin-panel', '/admin-subscriptions']
  if (protectedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    const response = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response.cookies.set(name, value)
          },
        },
      }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings', '/auth/:path*', '/admin-secret', '/admin-email', '/admin-panel', '/admin-subscriptions', '/admin-subscriptions/:path*'],
}