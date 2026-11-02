import { NextResponse, type NextRequest } from 'next/server'

// ============================================================================
// MIDDLEWARE RINGAN (v2) — TANPA supabase-js
// ============================================================================
// MASALAH LAMA (diperbaiki 2026-11-02):
//   Bundle middleware lama = 322 KB (menyematkan seluruh @supabase/ssr +
//   supabase-js GoTrueClient) + melakukan 1 network call `getUser()` per
//   pageview. Di Cloudflare Workers plan GRATIS (limit CPU 10ms/request),
//   evaluasi 322 KB JS pada isolat dingin (cold start) sering melewati batas
//   → Worker mati instan → HTTP 500 "Internal Server Error" ±30-40% dari
//   request yang melewati middleware (log produksi + stress test: /dashboard,
//   /settings, /auth/login gagal acak; /api & static asset 100% bersih).
//
// SOLUSI:
//   Middleware kini cukup MEMBACA cookie sesi Supabase + mendekode payload
//   JWT-nya secara lokal (atob — hampir 0 CPU, tanpa network, tanpa dependensi
//   supabase). Verifikasi kriptografis & refresh tetap dilakukan di lapisan
//   yang benar: API routes (requireAdmin / RLS / auth server-side) dan client
//   (auth-context auto-refresh). Pola standar aplikasi SPA.
//
// Jaminan keamanan TIDAK berubah:
//   - Data tetap dilindungi RLS + auth check di SETIAP API route.
//   - Yang berubah hanya UX redirect halaman (cookie dipalsukan akan lolos
//     redirect tapi tetap gagal di semua API call — shell redirect via client).
// ============================================================================

const PUBLIC_PATHS = ['/', '/about', '/blog', '/contact', '/faq', '/terms', '/privacy', '/disclaimer', '/refund-policy', '/not-found', '/upgrade']
const ADMIN_EMAILS = ['luxtradee@gmail.com']

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings',
    '/auth/:path*',
    '/admin-secret',
    '/admin-secure',
    '/admin-email',
    '/admin-dashboard-secret',
    '/admin-subscriptions',
    '/admin-subscriptions/:path*',
    '/admin/:path*',
  ],
}

// Force dynamic untuk middleware
export const dynamic = 'force-dynamic'

/** Parse raw Cookie header → map name → value (fix Workers: request.cookies bisa kosong). */
function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const trimmed = part.trimStart()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return out
}

/**
 * Decode base64URL → string. Runtime-agnostic: workerd `atob` strict
 * (nolak alphabet URL-safe), Node lenient — jadi dinormalisasi dulu.
 */
function fromBase64URL(s: string): string | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  } catch { return null }
}

/**
 * Ambil access token JWT dari cookie sesi Supabase.
 * Format cookie @supabase/ssr v0.9:
 *   1. `sb-<ref>-auth-token`          = `base64-` + base64URL(JSON sesi)
 *   2. `sb-<ref>-auth-token.0 .1 ...` = chunk (prefiks `base64-` hanya di chunk .0)
 *   3. fallback: nilai mentah JWT / JSON tanpa prefix
 */
function extractAccessToken(header: string | null): string | null {
  const cookies = parseCookieHeader(header)

  // Nama chunk (`-auth-token.0`) juga mengandung `-auth-token` — harus dikecualikan.
  const baseName = Object.keys(cookies).find(
    n => n.startsWith('sb-') && n.includes('-auth-token') && !/-auth-token\.\d+$/.test(n),
  )
  let raw: string | null = baseName ? cookies[baseName] : null

  if (raw == null) {
    const chunkNames = Object.keys(cookies)
      .filter(n => n.startsWith('sb-') && n.includes('-auth-token.'))
      .sort((a, b) => Number(a.split('.').pop()) - Number(b.split('.').pop()))
    if (chunkNames.length > 0) raw = chunkNames.map(n => cookies[n]).join('')
  }
  if (!raw) return null

  let value = raw
  if (value.startsWith('base64-')) {
    const decoded = fromBase64URL(value.slice(7))
    if (decoded == null) return null
    value = decoded
  }

  if (value.startsWith('eyJ')) return value // JWT mentah
  try {
    const session = JSON.parse(value) as { access_token?: unknown }
    return typeof session.access_token === 'string' ? session.access_token : null
  } catch { return null }
}

/** Dekode payload JWT TANPA verifikasi (hanya untuk keputusan redirect UX). */
function decodeJwtPayload(jwt: string): { email?: string; exp?: number } | null {
  try {
    const parts = jwt.split('.')
    if (parts.length < 2) return null
    const json = fromBase64URL(parts[1])
    if (json == null) return null
    return JSON.parse(json)
  } catch { return null }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow auth pages
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // Allow API routes (they handle their own auth)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public static pages
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const adminPaths = ['/dashboard/admin', '/admin-email', '/admin-secret', '/admin-secure', '/admin-dashboard-secret', '/admin-subscriptions', '/admin']
  const isAdminPath = adminPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  const protectedPaths = ['/dashboard', '/settings']
  const isProtectedPath = protectedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isAdminPath || isProtectedPath) {
    const redirectToLogin = () => {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    const accessToken = extractAccessToken(request.headers.get('cookie'))
    if (!accessToken) {
      // Belum ada sesi → login (perilaku lama untuk user logged-out)
      return redirectToLogin()
    }

    const payload = decodeJwtPayload(accessToken)
    if (!payload) {
      // Cookie rusak / bukan JWT → login
      return redirectToLogin()
    }

    // Token kedaluwarsa → login (refresh sesungguhnya terjadi client-side)
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      return redirectToLogin()
    }

    // Admin path: cocokkan email di payload token (penjaga sesungguhnya =
    // requireAdmin() di setiap /api/admin/* + RLS)
    if (isAdminPath) {
      const userEmail = payload.email?.toLowerCase().trim() || ''
      const isAuthorized = ADMIN_EMAILS.some(e => e.toLowerCase().trim() === userEmail)
      if (!isAuthorized) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    return NextResponse.next()
  }

  return NextResponse.next()
}
