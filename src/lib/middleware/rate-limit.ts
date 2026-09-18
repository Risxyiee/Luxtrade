/**
 * Rate Limiting Middleware untuk API Routes
 *
 * Penggunaan:
 * import { withRateLimit } from '@/lib/middleware/rate-limit'
 *
 * export const GET = withRateLimit(async (req, env) => {
 *   // Your handler code here
 * }, { limit: 10, window: 60 })
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getCloudflareEnv } from '@/lib/cloudflare-bindings'

interface RateLimitConfig {
  limit?: number        // Max requests (default: 100)
  window?: number       // Time window in seconds (default: 60)
  identifier?: string   // Custom identifier (default: IP address)
  skipSuccessful?: boolean // Don't count successful requests (default: false)
}

/**
 * Wrapper untuk rate limiting pada API routes
 */
export function withRateLimit(
  handler: (request: NextRequest, env: any) => Promise<NextResponse>,
  config: RateLimitConfig = {}
) {
  return async (request: NextRequest) => {
    const {
      limit = 100,
      window = 60,
      skipSuccessful = false,
    } = config

    // Get identifier (IP address or custom)
    const ip = request.headers.get('cf-connecting-ip') ||
               request.headers.get('x-forwarded-for')?.split(',')[0] ||
               'unknown'

    const identifier = config.identifier || ip

    try {
      const env = getCloudflareEnv(request)

      // Check rate limit
      const rateLimitResult = await checkRateLimit(env, identifier, limit, window)

      // Add rate limit headers to response
      const headers: Record<string, string> = {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
      }

      if (!rateLimitResult.allowed) {
        // Rate limit exceeded
        headers['Retry-After'] = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString()

        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again after ${Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)} seconds.`,
          },
          {
            status: 429,
            headers,
          }
        )
      }

      // Execute handler
      const response = await handler(request, env)

      // Add rate limit headers to successful response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    } catch (error) {
      console.error('[RateLimitMiddleware] Error:', error)
      // Fail open - allow request if rate limiter fails
      return handler(request, {})
    }
  }
}

/**
 * Rate limiting untuk auth endpoints (lebih ketat)
 */
export const withAuthRateLimit = (
  handler: (request: NextRequest, env: any) => Promise<NextResponse>
) => {
  return withRateLimit(handler, {
    limit: 5,        // Max 5 requests
    window: 60,      // Per minute
    skipSuccessful: false,
  })
}

/**
 * Rate limiting untuk critical operations
 */
export const withStrictRateLimit = (
  handler: (request: NextRequest, env: any) => Promise<NextResponse>
) => {
  return withRateLimit(handler, {
    limit: 10,       // Max 10 requests
    window: 60,      // Per minute
    skipSuccessful: false,
  })
}

/**
 * Rate limiting untuk general API (lebih longgar)
 */
export const withGeneralRateLimit = (
  handler: (request: NextRequest, env: any) => Promise<NextResponse>
) => {
  return withRateLimit(handler, {
    limit: 100,      // Max 100 requests
    window: 60,      // Per minute
    skipSuccessful: false,
  })
}