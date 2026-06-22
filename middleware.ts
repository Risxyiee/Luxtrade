import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Protected routes that require authentication
const protectedRoutes = ['/dashboard', '/admin-subscriptions']

// Public auth routes
const authRoutes = ['/auth/login', '/auth/signup', '/auth/verify', '/auth/reset-password']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // Skip auth guard if Supabase env vars are missing (local dev without .env)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey || supabaseKey === 'your_anon_key_here') {
    return res
  }

  // Create Supabase client for middleware using @supabase/ssr
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set({ name, value: '', ...options })
      },
    },
  })

  // Get session
  const { data: { session } } = await supabase.auth.getSession()

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname === route)

  // If user is NOT logged in and tries to access protected route
  if (!session && isProtectedRoute) {
    const redirectUrl = new URL('/auth/login', req.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user IS logged in and tries to access login/signup, redirect to dashboard
  if (session && isAuthRoute) {
    const redirectParam = req.nextUrl.searchParams.get('redirect')
    return NextResponse.redirect(new URL(redirectParam || '/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin-subscriptions/:path*',
    '/auth/login',
    '/auth/signup',
    '/auth/verify',
    '/auth/reset-password',
  ],
}
