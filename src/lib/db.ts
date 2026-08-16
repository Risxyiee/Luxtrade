import { PrismaClient } from '@prisma/client'

/**
 * Database connection with URL normalization.
 * - Fixes common Vercel env var corruption (file prefix, doubled protocol)
 * - Auto-detects Supabase direct connection and converts to pooler
 * - Handles pgbouncer compatibility (pooler port, pgBouncer mode)
 * - Graceful fallback for local dev without proper database (returns safe responses instead of crashes)
 */

function normalizeUrl(raw: string): string {
  let url = raw.trim()

  // Fix: "file:./postgresql://..." → "postgresql://..."
  if (url.startsWith('file:./') && url.includes('postgresql://')) {
    url = url.replace(/^file:\.\/?/, '')
  }
  if (url.startsWith('file:') && url.includes('postgresql://')) {
    url = url.replace(/^file:/, '')
  }
  if (url.startsWith('file:./') && url.includes('postgres://')) {
    url = url.replace(/^file:\.\/?/, '')
  }
  if (url.startsWith('file:') && url.includes('postgres://')) {
    url = url.replace(/^file:/, '')
  }

  // Fix doubled protocol: "ppostgresql://" → "postgresql://"
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://') && url.includes('postgresql://')) {
    url = url.substring(url.indexOf('postgresql://'))
  }
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://') && url.includes('postgres://')) {
    url = url.substring(url.indexOf('postgres://'))
  }

  // Auto-detect Supabase direct connection and convert to pooler
  const isDirectSupabase = url.includes('supabase.co') && (url.includes(':5432') || url.match(/db\.[\w-]+\.supabase\.co/))

  if (isDirectSupabase && url.includes(':5432')) {
    const match = url.match(/:\/\/([^:]+):([^@]+)@db\.([\w-]+)\.supabase\.co:5432\/(\w+)/)
    if (match) {
      const [, user, password, project, database] = match
      const poolerUrl = `postgresql://${user}.${project}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:6543/${database}?pgbouncer=true`

      console.log('🔄 [DB] Auto-converting Supabase direct → pooler URL')
      return poolerUrl
    }
  }

  // If user already has pooler URL but missing pgbouncer param, add it
  if (url.includes('pooler.supabase.com') && !url.includes('pgbouncer')) {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}pgbouncer=true`
  }

  return url
}

const getDatabaseUrl = (): string | null => {
  const raw = process.env.DATABASE_URL

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production')
    }
    _dbUnavailableReason = 'DATABASE_URL not set'
    return null
  }

  // If it's a file: URL (SQLite for local dev), skip — Prisma schema is PostgreSQL
  if (raw.trim().startsWith('file:')) {
    _dbUnavailableReason = `DATABASE_URL is SQLite (file:), but schema requires PostgreSQL. Set a PostgreSQL URL for full functionality.`
    return null
  }

  return normalizeUrl(raw)
}

// Singleton to prevent exhausting connections
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _dbAvailable = false
let _dbUnavailableReason: string | null = null
let _rawPrisma: PrismaClient | undefined = undefined

try {
  const dbUrl = getDatabaseUrl()

  if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
    if (!globalForPrisma.prisma) {
      // Append connection pool limits to prevent "max clients reached" on Supabase
      // Free tier pooler = 15 connections; each Vercel function instance takes one.
      // Use connection_limit=3: each serverless function needs at most 2-3 connections,
      // and with 15 pool slots we can safely run ~5 concurrent functions.
      const poolUrl = dbUrl.includes('?')
        ? `${dbUrl}&connection_limit=3&pool_timeout=15`
        : `${dbUrl}?connection_limit=3&pool_timeout=15`

      globalForPrisma.prisma = new PrismaClient({
        datasourceUrl: poolUrl,
        log: ['error', 'warn'],
      })
    }
    _rawPrisma = globalForPrisma.prisma
    _dbAvailable = true

    console.log('🗄️ ============================================')
    console.log('🗄️ Database Type: PostgreSQL')
    console.log(`🗄️ Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log('🗄️ ============================================')
  } else {
    _dbUnavailableReason = dbUrl ? 'Invalid database URL format (not PostgreSQL)' : 'No DATABASE_URL configured'
    console.log('🗄️ ============================================')
    console.log(`🗄️ Database: UNAVAILABLE — ${_dbUnavailableReason}`)
    console.log('🗄️ Features requiring database will return safe defaults.')
    console.log('🗄️ ============================================')
  }
} catch (err: any) {
  _dbUnavailableReason = err.message || 'Unknown error'
  console.error('⚠️ [DB] Failed to initialize database client:', err)
  console.log('🗄️ ============================================')
  console.log('🗄️ Database: UNAVAILABLE — running in offline mode')
  console.log('🗄️ ============================================')
}

/**
 * Check if database is available for queries.
 */
export function isDatabaseAvailable(): boolean {
  return _dbAvailable
}

/**
 * Get the reason why database is unavailable.
 */
export function getDatabaseUnavailableReason(): string {
  return _dbUnavailableReason || 'Database not configured'
}

/**
 * Proxy-based db wrapper that gracefully handles database unavailability.
 */
function createDbProxy(prisma: PrismaClient | undefined): PrismaClient {
  if (prisma) return prisma

  return new Proxy({} as PrismaClient, {
    get(_target, prop, receiver) {
      if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
        return () => '[DB Unavailable]'
      }
      if (typeof prop === 'string' && (prop === 'then' || prop === 'toJSON')) {
        return undefined
      }

      return new Proxy({}, {
        get(_, methodProp) {
          return (...args: any[]) => {
            throw new Error(
              `Database is not available (${_dbUnavailableReason || 'no DATABASE_URL'}). ` +
              `Cannot execute db.${String(prop)}.${String(methodProp)}().`
            )
          }
        }
      })
    }
  })
}

export const db: PrismaClient = createDbProxy(_rawPrisma)

/**
 * DEPRECATED: ensureSchema() is now a NO-OP.
 * 
 * Disabled because multiple Vercel instances running ensureSchema() simultaneously
 * caused race conditions (error 23505 "already exists" vs 42P01 "does not exist"
 * on promo_codes table).
 * 
 * Schema changes should be done via:
 *   1. Supabase SQL Editor (manual)
 *   2. Prisma migrations (proper)
 */
export async function ensureSchema(): Promise<void> {
  // No-op: auto-migration disabled to prevent race conditions.
  // All callers still work — this just returns immediately.
}