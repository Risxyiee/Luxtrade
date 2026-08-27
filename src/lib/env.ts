/**
 * Environment validation at startup
 */
import { envValidator } from './env-validator'

if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
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
      'RAPIDAPI_TRADING_ECONOMICS_KEY',
    ],
    validateFn: (env) => {
      const errors: string[] = []

      // Validate database URL format
      if (env.DATABASE_URL && !env.DATABASE_URL.startsWith('postgresql://')) {
        errors.push('DATABASE_URL must be a PostgreSQL connection string')
      }

      // Validate Supabase URLs are valid
      if (env.NEXT_PUBLIC_SUPABASE_URL && !env.NEXT_PUBLIC_SUPABASE_URL.includes('supabase.co')) {
        errors.push('Invalid NEXT_PUBLIC_SUPABASE_URL - must be a Supabase project URL')
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    },
  })
}

export { envValidator } from './env-validator'
