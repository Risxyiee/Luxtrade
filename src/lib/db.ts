/**
 * Edge-compatible Prisma client for Cloudflare Workers / Cloudflare Pages.
 *
 * Uses @prisma/adapter-pg + pg (or @neondatabase/serverless) to connect
 * via WebSocket/HTTP instead of Node.js TCP sockets.
 *
 * Connection resolution:
 *   1. DATABASE_POOLER_URL — if set, used directly (no transformation)
 *   2. Auto-detect Supabase direct URLs → convert to pooler
 *
 * Works on: Cloudflare Workers, Vercel Edge, Deno, Node.js
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Normalize a raw DATABASE_URL into a clean postgresql:// connection string.
 * Fixes Vercel env var corruption and handles pooler conversion.
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

  // Env-driven pooler URL
  const poolerEnvUrl = process.env.DATABASE_POOLER_URL?.trim()
  if (poolerEnvUrl) {
    return poolerEnvUrl
  }

  // Auto-detect: convert Supabase direct connection to pooler
  const isDirectSupabase = url.includes('supabase.co') && (url.includes(':5432') || url.match(/db\.[\w-]+\.supabase\.co/))

  if (isDirectSupabase && url.includes(':5432')) {
    const match = url.match(/:\/\/([^:]+):([^@]+)@db\.([\w-]+)\.supabase\.co:5432\/(\w+)/)
    if (match) {
      console.warn('[db] DATABASE_POOLER_URL not set, using auto-detect pooler conversion. Set DATABASE_POOLER_URL for reliability.')
      const [, user, password, project, database] = match
      const poolerUrl = `postgresql://${user}.${project}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:6543/${database}?pgbouncer=true`
      return poolerUrl
    }
  }

  // If already pooler URL but missing pgbouncer param, add it
  if (url.includes('pooler.supabase.com') && !url.includes('pgbouncer')) {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}pgbouncer=true`
  }

  return url
}

const getDatabaseUrl = (): string | null => {
  const raw = process.env.DATABASE_URL

  if (!raw) {
    // During `next build` static analysis, DATABASE_URL may not be set.
    // Never throw — let the proxy handle it at runtime.
    _dbUnavailableReason = 'DATABASE_URL not set'
    return null
  }

  // If it's a file: URL (SQLite for local dev), skip
  if (raw.trim().startsWith('file:')) {
    _dbUnavailableReason = `DATABASE_URL is SQLite (file:), but schema requires PostgreSQL.`
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
      // Build connection string with pool limits
      const poolUrl = dbUrl.includes('?')
        ? `${dbUrl}&connection_limit=3&pool_timeout=15`
        : `${dbUrl}?connection_limit=3&pool_timeout=15`

      // Create Edge-compatible adapter using pg
      // PrismaPg wraps the `pg` Pool and uses it via WebSocket/TCP
      const adapter = new PrismaPg(poolUrl)

      globalForPrisma.prisma = new PrismaClient({
        adapter,
        log: ['error', 'warn'],
      })
    }
    _rawPrisma = globalForPrisma.prisma
    _dbAvailable = true

    console.log('🗄️ ============================================')
    console.log('🗄️ Database: PostgreSQL (Edge-compatible via PrismaPg)')
    console.log(`🗄️ Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log('🗄️ ============================================')
  } else {
    _dbUnavailableReason = dbUrl ? 'Invalid database URL format (not PostgreSQL)' : 'No DATABASE_URL configured'
    console.log('🗄️ ============================================')
    console.log(`🗄️ Database: UNAVAILABLE — ${_dbUnavailableReason}`)
    console.log('🗄️ ============================================')
  }
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  _dbUnavailableReason = message
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
          return (...args: unknown[]) => {
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
 * DEPRECATED: ensureSchema() is a NO-OP.
 */
export async function ensureSchema(): Promise<void> {
  // No-op
}