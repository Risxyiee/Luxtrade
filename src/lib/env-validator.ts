/**
 * Environment variable validation untuk startup
 * Fail-fast jika ada required env vars yang missing
 */

import { logger } from './logger'

export interface EnvValidationConfig {
  required: string[]
  optional?: string[]
  validateFn?: (env: NodeJS.ProcessEnv) => { valid: boolean; errors: string[] }
}

class EnvValidator {
  private validated = false
  private errors: string[] = []

  /**
   * Validate environment variables at startup
   * Throws error if validation fails
   */
  validate(config: EnvValidationConfig): void {
    if (this.validated) return

    const missing: string[] = []
    const invalid: string[] = []

    // Check required vars
    for (const key of config.required) {
      if (!process.env[key]) {
        missing.push(key)
      }
    }

    // Custom validation if provided
    if (config.validateFn) {
      const result = config.validateFn(process.env)
      if (!result.valid) {
        invalid.push(...result.errors)
      }
    }

    // Collect all errors
    const allErrors = [
      ...missing.map(k => `Missing required env: ${k}`),
      ...invalid,
    ]

    if (allErrors.length > 0) {
      this.errors = allErrors
      const errorMsg = allErrors.join('\n  - ')
      logger.fatal(`Environment validation failed:\n  - ${errorMsg}`)
      throw new Error(`Invalid environment configuration: ${allErrors[0]}`)
    }

    this.validated = true
    logger.info('✓ Environment validation passed')
  }

  /**
   * Get validated env var (throws if not set)
   */
  get(key: string, fallback?: string): string {
    const value = process.env[key] || fallback
    if (!value) {
      throw new Error(`Environment variable not found: ${key}`)
    }
    return value
  }

  /**
   * Get validated env var as boolean
   */
  getBoolean(key: string, fallback = false): boolean {
    const value = process.env[key]
    if (!value) return fallback
    return value.toLowerCase() === 'true' || value === '1'
  }

  /**
   * Get validated env var as number
   */
  getNumber(key: string, fallback?: number): number {
    const value = process.env[key]
    if (!value) {
      if (fallback !== undefined) return fallback
      throw new Error(`Environment variable not found: ${key}`)
    }
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      throw new Error(`Invalid number for env var ${key}: ${value}`)
    }
    return num
  }
}

export const envValidator = new EnvValidator()

/**
 * Validate on application startup
 */
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Validate critical env vars for production
  if (process.env.NODE_ENV === 'production') {
    envValidator.validate({
      required: [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'DATABASE_URL',
      ],
      optional: [
        'MIDTRANS_SERVER_KEY',
        'MIDTRANS_CLIENT_KEY',
        'ZAI_API_KEY',
      ],
    })
  }
}
