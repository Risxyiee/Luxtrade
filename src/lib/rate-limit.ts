/**
 * Simple in-memory rate limiter for Cloudflare Workers.
 *
 * ⚠️ TRADE-OFF (wajib dipahami):
 * - In-memory = TIDAK share antar Worker isolate.
 *   Jika Cloudflare spin beberapa isolate sekaligus, tiap isolate punya counter sendiri.
 *   Akibatnya: user bisa melewati limit sebenarnya (per isolate).
 * - Untuk traffic kecil (<1000 concurrent users), ini biasanya cukup karena
 *   Workers cenderung reuse isolate yang sama (warm start).
 * - Untuk production berskala besar, upgrade ke Upstash Redis atau Cloudflare D1.
 *
 * Auto-cleanup: entries yang sudah expired dihapus setiap 60 detik.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number // epoch ms
}

const store = new Map<string, RateLimitEntry>()
let lastCleanup = 0
const CLEANUP_INTERVAL = 60_000

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

/**
 * Ambil IP client dari header tepercaya.
 *
 * SECURITY (audit #6): dulu IP diambil dari `x-forwarded-for` ENTRI PERTAMA —
 * header itu bisa di-spoof client, jadi rate limit bisa direset dengan
 * mengganti header. Sekarang:
 *   1. `cf-connecting-ip` — diset Cloudflare edge, tidak bisa di-spoof (prod).
 *   2. Entri TERAKHIR `x-forwarded-for` — ditambahkan proxy tepercaya
 *      terdekat (Cloudflare), bukan entri pertama yang dikirim attacker.
 *   3. `x-real-ip` / 'unknown' — fallback lokal/dev.
 */
export function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()

  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Custom error message (optional) */
  message?: string
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given key.
 * If rate limited, returns { success: false, remaining: 0, resetAt }.
 * If allowed, increments counter and returns { success: true, remaining, resetAt }.
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const entry = store.get(key)

  // No existing entry or window expired → create new
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { success: true, remaining: config.maxRequests - 1, resetAt }
  }

  // Within window → check count
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  entry.count++
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Helper: create a 429 NextResponse if rate limited, or null if allowed.
 * Usage:
 *   const limited = checkRateLimit(request, 'login', { maxRequests: 5, windowMs: 900000 })
 *   if (limited) return limited
 */
export function checkRateLimit(
  request: NextRequest,
  identifier: string,
  config: RateLimitConfig,
  keyBy?: 'ip' | 'email' | 'userId'
): NextResponse | null {
  let key: string

  if (keyBy === 'email') {
    // Extract email from request body (POST only)
    key = `rl:${identifier}:email:unknown`
    try {
      // Clone request to read body without consuming it
      const cloned = request.clone()
      const body = cloned.json()
      // body is a Promise, we need to handle async... but this is sync.
      // For simplicity, use IP as fallback — the actual enforcement happens
      // in the route handler with async body parsing.
      // This helper is primarily for IP-based limiting.
    } catch (e) {
      // Cannot clone body or parse JSON — fallback to IP
    }
    // Fall through to IP-based
    const ip = getClientIp(request)
    key = `rl:${identifier}:${ip}`
  } else if (keyBy === 'userId') {
    // For authenticated routes, caller should pass the userId directly
    const ip = getClientIp(request)
    key = `rl:${identifier}:unknown-user:${ip}`
  } else {
    // Default: IP-based
    const ip = getClientIp(request)
    key = `rl:${identifier}:${ip}`
  }

  const result = rateLimit(key, config)

  if (!result.success) {
    const retryAfterSecs = Math.ceil((result.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      {
        error: config.message || `Terlalu banyak permintaan. Coba lagi dalam ${retryAfterSecs} detik.`,
        retryAfter: retryAfterSecs,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSecs),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null
}

/**
 * Rate limit by user ID (for authenticated routes).
 * Call this AFTER getting the user from auth.
 */
export function rateLimitByUser(
  identifier: string,
  userId: string,
  config: RateLimitConfig
): NextResponse | null {
  const key = `rl:${identifier}:user:${userId}`
  const result = rateLimit(key, config)

  if (!result.success) {
    const retryAfterSecs = Math.ceil((result.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      {
        error: config.message || `Terlalu banyak permintaan. Coba lagi dalam ${retryAfterSecs} detik.`,
        retryAfter: retryAfterSecs,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSecs),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null
}

/**
 * Rate limit by email address.
 * For auth endpoints where we parse the email from body.
 */
export function rateLimitByEmail(
  identifier: string,
  email: string,
  config: RateLimitConfig
): NextResponse | null {
  const key = `rl:${identifier}:email:${email.toLowerCase()}`
  const result = rateLimit(key, config)

  if (!result.success) {
    const retryAfterSecs = Math.ceil((result.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      {
        error: config.message || `Terlalu banyak permintaan. Coba lagi dalam ${retryAfterSecs} detik.`,
        retryAfter: retryAfterSecs,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSecs),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null
}