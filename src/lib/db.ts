/**
 * Edge-compatible Prisma client for Cloudflare Workers / Cloudflare Pages.
 *
 * Uses @prisma/adapter-neon + @neondatabase/serverless to connect
 * via WebSocket/HTTP — zero Node.js native module dependencies.
 *
 * Works on: Cloudflare Workers, Vercel Edge, Deno, Node.js
 */

import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

/**
 * Normalize a raw DATABASE_URL into a clean postgresql:// connection string.
 */
function normalizeUrl(raw: string): string {
  let url = raw.trim()

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

  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://') && url.includes('postgresql://')) {
    url = url.substring(url.indexOf('postgresql://'))
  }
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://') && url.includes('postgres://')) {
    url = url.substring(url.indexOf('postgres://'))
  }

  const poolerEnvUrl = process.env.DATABASE_POOLER_URL?.trim()
  if (poolerEnvUrl) {
    return poolerEnvUrl
  }

  const isDirectSupabase = url.includes('supabase.co') && (url.includes(':5432') || url.match(/db\.[\w-]+\.supabase\.co/))

  if (isDirectSupabase && url.includes(':5432')) {
    const match = url.match(/:\/\/([^:]+):([^@]+)@db\.([\w-]+)\.supabase\.co:5432\/(\w+)/)
    if (match) {
      console.warn('[db] DATABASE_POOLER_URL not set, using auto-detect pooler conversion.')
      const [, user, password, project, database] = match
      return `postgresql://${user}.${project}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:6543/${database}?pgbouncer=true`
    }
  }

  if (url.includes('pooler.supabase.com') && !url.includes('pgbouncer')) {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}pgbouncer=true`
  }

  return url
}

/**
 * Lazy-initialize the Prisma client.
 * CRITICAL: On Cloudflare Workers, process.env is only available at request time,
 * NOT at module load time. This function must be called inside a request handler.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _initAttempted = false
let _dbAvailable = false
let _dbUnavailableReason: string | null = null
let _lastInitEnvHash: string | null = null

function _envHash(): string {
  return (process.env.DATABASE_URL || '') + '|' + (process.env.DATABASE_POOLER_URL || '')
}

function _tryInitDb(force = false): void {
  // On Cloudflare Workers, process.env is populated at request time.
  // The first call during an edge cold start may have empty env.
  // We allow re-init if env vars have changed (or force=true).
  const currentHash = _envHash()
  if (!force && _initAttempted && currentHash === _lastInitEnvHash) return
  _initAttempted = true
  _lastInitEnvHash = currentHash

  try {
    const raw = process.env.DATABASE_URL

    if (!raw) {
      // Don't mark as permanent failure — env may populate on next request
      _dbUnavailableReason = 'DATABASE_URL not set'
      console.warn('[DB] DATABASE_URL not set yet (may populate on next request)')
      _initAttempted = false // Allow retry
      return
    }

    if (raw.trim().startsWith('file:')) {
      _dbUnavailableReason = 'DATABASE_URL is SQLite (file:), but schema requires PostgreSQL.'
      console.error('[DB] SQLite URL detected, PostgreSQL required')
      return
    }

    const dbUrl = normalizeUrl(raw)

    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      _dbUnavailableReason = 'Invalid database URL format (not PostgreSQL)'
      console.error('[DB] Invalid URL format:', dbUrl)
      return
    }

    const poolUrl = dbUrl.includes('?')
      ? `${dbUrl}&connection_limit=3&pool_timeout=15`
      : `${dbUrl}?connection_limit=3&pool_timeout=15`

    const sql = neon(poolUrl)
    const adapter = new PrismaNeon(sql)

    // Dispose old client if re-initializing
    if (globalForPrisma.prisma) {
      try { (globalForPrisma.prisma as any).$disconnect().catch(() => {}) } catch {}
    }

    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log: ['error', 'warn'],
    })

    _dbAvailable = true
    _dbUnavailableReason = null
    console.log('[DB] ✅ Prisma client initialized successfully')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    _dbUnavailableReason = message
    // Allow retry on transient failures
    _initAttempted = false
    console.error('[DB] Failed to initialize database client (will retry next call):', err)
  }
}

export function isDatabaseAvailable(): boolean {
  _tryInitDb()
  return _dbAvailable
}

export function getDatabaseUnavailableReason(): string {
  _tryInitDb()
  return _dbUnavailableReason || 'Database not configured'
}

/**
 * Get the real Prisma client (or null if unavailable).
 * Always call _tryInitDb() first to ensure lazy init.
 */
function getDb(): PrismaClient | null {
  _tryInitDb()
  return _dbAvailable ? globalForPrisma.prisma! : null
}

function createDbProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
        return () => '[DB Unavailable]'
      }
      if (typeof prop === 'string' && (prop === 'then' || prop === 'toJSON')) {
        return undefined
      }

      return new Proxy({}, {
        get(_, methodProp) {
          return (...args: unknown[]) => {
            _tryInitDb(true) // Always try init on every access — env vars may not be ready on cold start
            if (_dbAvailable && globalForPrisma.prisma) {
              // Forward to real Prisma client
              const model = (globalForPrisma.prisma as any)[String(prop)]
              if (model && typeof model[String(methodProp)] === 'function') {
                return model[String(methodProp)](...args)
              }
            }
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

/** Lazy-initialized database proxy — always tries to connect on first real use */
export const db: PrismaClient = createDbProxy()

export async function ensureSchema(): Promise<void> {
  // No-op
}
