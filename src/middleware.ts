import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware: Auth Guard
 * - Halaman /dashboard, /upgrade, /admin-subscriptions wajib login
 * - Jika belum login → redirect ke /auth/login?redirect=/path-asli
 * - Halaman /auth/* sudah login → redirect ke /dashboard
 */

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const { pathname } = request.nextUrl

  // Halaman yang WAJIB login
  const protectedPaths = ['/dashboard', '/upgrade', '/admin-subscriptions']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  // Halaman auth (login, signup, dll)
  const isAuthPage = pathname.startsWith('/auth')

  // Buat Supabase client untuk baca session dari cookie
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Cek session user
  const { data: { user } } = await supabase.auth.getUser()

  // Kalau halaman protected tapi belum login → redirect ke login
  if (isProtected && !user) {
    const redirectUrl = encodeURIComponent(pathname)
    const loginUrl = `/auth/login?redirect=${redirectUrl}`
    const url = request.nextUrl.clone()
    url.pathname = loginUrl
    return NextResponse.redirect(url)
  }

  // Kalau halaman auth tapi sudah login → redirect ke dashboard
  if (isAuthPage && user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    // Cek ada redirect param dari halaman protected yang tadi mau diakses
    const redirectParam = request.nextUrl.searchParams.get('redirect')
    const targetUrl = request.nextUrl.clone()
    targetUrl.pathname = redirectParam || '/dashboard'
    return NextResponse.redirect(targetUrl)
  }

  return response
}

// Konfigurasi matcher: middleware jalan hanya untuk path ini
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/upgrade/:path*',
    '/admin-subscriptions/:path*',
    '/auth/login',
    '/auth/signup',
    '/auth/verify',
    '/auth/reset-password',
  ],
}
