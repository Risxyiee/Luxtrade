/**
 * Centralized error handling untuk API routes
 * Sanitize error messages untuk production
 */

import { NextResponse } from 'next/server'
import { logger } from './logger'

export interface ApiErrorResponse {
  error: string // user-facing message
  code?: string // error code untuk frontend
  status: number
}

/**
 * Sanitize error message untuk production
 * Development: return full error message
 * Production: return generic message
 */
function getSafeErrorMessage(error: any, fallback: string = 'Internal server error'): string {
  if (process.env.NODE_ENV === 'development') {
    return error?.message || String(error) || fallback
  }
  return fallback
}

/**
 * Handle API errors consistently
 */
export function handleApiError(
  error: any,
  context?: {
    endpoint?: string
    userId?: string
    userMessage?: string
  }
): NextResponse<ApiErrorResponse> {
  const endpoint = context?.endpoint || 'unknown'
  const userId = context?.userId || 'anonymous'

  // Log the error with full details
  logger.error(`API error at ${endpoint}`, error, {
    userId,
    endpoint,
  })

  // Determine status code
  let statusCode = 500
  let errorCode = 'INTERNAL_ERROR'
  let userMessage = context?.userMessage || 'Terjadi kesalahan pada server'

  if (error?.status) {
    statusCode = error.status
  } else if (error?.code === 'UNAUTHORIZED') {
    statusCode = 401
    errorCode = 'UNAUTHORIZED'
    userMessage = 'Kamu harus login untuk mengakses fitur ini'
  } else if (error?.code === 'FORBIDDEN') {
    statusCode = 403
    errorCode = 'FORBIDDEN'
    userMessage = 'Kamu tidak memiliki akses untuk fitur ini'
  } else if (error?.code === 'NOT_FOUND') {
    statusCode = 404
    errorCode = 'NOT_FOUND'
    userMessage = 'Data tidak ditemukan'
  } else if (error?.code === 'VALIDATION_ERROR') {
    statusCode = 400
    errorCode = 'VALIDATION_ERROR'
    userMessage = error?.message || 'Data yang dikirim tidak valid'
  }

  return NextResponse.json(
    {
      error: userMessage,
      code: errorCode,
      status: statusCode,
    },
    { status: statusCode }
  )
}

/**
 * Wrap async handler function dengan error catching
 */
export function asyncHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  context?: { endpoint?: string }
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error, context)
    }
  }
}

/**
 * Validate required environment variables
 */
export function validateEnvVars(...vars: string[]): { valid: boolean; missing: string[] } {
  const missing = vars.filter(v => !process.env[v])
  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Assert environment variable exists
 */
export function assertEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    const error = new Error(`Missing required environment variable: ${name}`)
    logger.fatal(`Missing env var: ${name}`, error)
    throw error
  }
  return value
}
