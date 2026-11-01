import { NextRequest } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { User, SupabaseClient } from '@supabase/supabase-js'

interface AuthResult {
  user: User | null
  client: SupabaseClient | null
  error?: string
}

// ── PERF (laporan Bos: "onboarding & loading masuk dashboard masih berat") ──
// Satu buka dashboard = 10-15 request API paralel dengan TOKEN YANG SAMA.
// Dulu TIAP request menjalankan supabase.auth.getUser() = 1 roundtrip HTTP
// ke Supabase Auth (±100-300ms per request di CF Workers) → belasan roundtrip
// hanya untuk re-verifikasi token identik.
//
// Solusi: cache hasil verifikasi per-kredensial (key = SHA-256, kredensial
// mentah TIDAK PERNAH disimpan) + dedupe in-flight supaya burst paralel
// hanya menembus 1 roundtrip. TTL pendek (30 detik / sisa-umur token) —
// jendela staleness jauh di bawah masa aktif token Supabase (default 1 jam).
const AUTH_CACHE_TTL_MS = 30_000
const AUTH_CACHE_MAX = 500
const authCache = new Map<string, { user: User; expiresAt: number }>()
const authInFlight = new Map<string, Promise<User | null>>()

async function sha256Hex(input: string): Promise<string> {
  try {
    const subtle = (globalThis as any).crypto?.subtle
    if (subtle) {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input))
      return Array.from(new Uint8Array(digest)).map((b: number) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {}
  // Fallback non-kripto — cukup sebagai cache key lokal (bukan untuk keamanan)
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return 'f' + h.toString(16) + ':' + input.length
}

function cacheRead(key: string): User | null {
  const hit = authCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    authCache.delete(key)
    return null
  }
  return hit.user
}

function cacheWrite(key: string, user: User, ttlMs: number = AUTH_CACHE_TTL_MS): void {
  if (ttlMs <= 0) return
  if (authCache.size >= AUTH_CACHE_MAX) {
    const oldest = authCache.keys().next().value
    if (oldest) authCache.delete(oldest)
  }
  authCache.set(key, { user, expiresAt: Date.now() + ttlMs })
}

/** Gabungkan verifikasi paralel ber-key sama → 1 roundtrip. Hanya sukses yang di-cache. */
async function verifyOnce(key: string, verify: () => Promise<User | null>, ttlMs?: number): Promise<User | null> {
  const cached = cacheRead(key)
  if (cached) return cached
  const inflight = authInFlight.get(key)
  if (inflight) return inflight
  const p = (async () => {
    const user = await verify()
    if (user) cacheWrite(key, user, ttlMs)
    return user
  })().finally(() => authInFlight.delete(key))
  authInFlight.set(key, p)
  return p
}

/**
 * Get authenticated user and Supabase client from request.
 * Handles both cookie-based and Bearer token authentication.
 *
 * @param request - NextRequest object
 * @returns AuthResult with user, client, and optional error
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  try {
    const result = await createClientForApi(request)
    const cookieClient = result.supabase

    // Check if Supabase client was created successfully
    if (!cookieClient) {
      console.error('[getAuthenticatedUser] createClientForApi returned null - environment variables may not be configured')
      return { user: null, client: null, error: 'Server configuration error' }
    }

    // PERF: verifikasi via cache per-cookie-header — burst request paralel
    // dari satu buka dashboard hanya 1 roundtrip ke Supabase Auth.
    let cookieKey: string | null = null
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      try { cookieKey = 'c:' + await sha256Hex(cookieHeader) } catch { cookieKey = null }
    }

    let user: User | null = null
    if (cookieKey) {
      user = await verifyOnce(cookieKey, async () => {
        const { data } = await cookieClient.auth.getUser()
        return data.user ?? null
      })
    } else {
      const { data } = await cookieClient.auth.getUser()
      user = data.user ?? null
    }
    if (user) {
      console.log('[getAuthenticatedUser] User authenticated via cookies:', user.email)
      return { user, client: cookieClient }
    }

    // INFO (bukan error): request anonim (bot/probe/curl) tanpa cookie juga
    // lewat sini sebelum 401 — normal, jangan alarm. Bearer fallback di bawah.
    console.log('[getAuthenticatedUser] No session cookie, trying Bearer fallback (normal for anonymous requests)...')

    // Try Bearer token authentication
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseKey) {
        console.error('[getAuthenticatedUser] NEXT_PUBLIC_SUPABASE_ANON_KEY not configured')
        return { user: null, client: null, error: 'Server configuration error' }
      }

      // CRITICAL FIX (2026-10-30): JWT user WAJIB nempel di SEMUA request client
      // ini. Dulu auth.getUser(token) cuma validasi token — query .from()
      // berikutnya jalan TANPA JWT user → PostgREST anggap anonymous → RLS
      // auth.uid() null → data kosong / insert gagal (gejala: login sukses
      // tapi journal/trades kosong saat cookie parsing CF Workers gagal dan
      // Bearer jadi satu-satunya jalur auth). Dengan global.headers, semua
      // query PostgREST bawa JWT user → RLS bekerja normal.
      const bearerClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      })
      // TTL dibatasi sisa umur token (exp − 30s) — tidak pernah melewati exp
      let bearerTtl = AUTH_CACHE_TTL_MS
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (typeof payload.exp === 'number') {
          bearerTtl = Math.min(bearerTtl, payload.exp * 1000 - Date.now() - 30_000)
        }
      } catch {}
      const bearerKey = 'b:' + await sha256Hex(token)
      const bearerUser = await verifyOnce(bearerKey, async () => {
        const result = await bearerClient.auth.getUser(token)
        return result.data.user ?? null
      }, bearerTtl)
      if (bearerUser) {
        console.log('[getAuthenticatedUser] User authenticated via Bearer token:', bearerUser.email)
        return { user: bearerUser, client: bearerClient }
      } else {
        console.warn('[getAuthenticatedUser] Bearer token invalid or expired')
      }
    }

    return { user: null, client: cookieClient }
  } catch (error) {
    console.error('[getAuthenticatedUser] Error:', error)
    return { user: null, client: null, error: 'Authentication failed' }
  }
}

/**
 * Require authentication - returns error response if not authenticated.
 *
 * @param request - NextRequest object
 * @returns Object with user and client, or error response if not authenticated
 */
export async function requireAuth(request: NextRequest) {
  const { user, client, error } = await getAuthenticatedUser(request)

  if (!user || !client) {
    return {
      user: null,
      client: null,
      response: new Response(
        JSON.stringify({ error: error || 'Unauthorized - Please login' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  return { user, client, response: null }
}