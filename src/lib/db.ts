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

const getDatabaseUrl = (): string | null => {
  const raw = process.env.DATABASE_URL

  if (!raw) {
    _dbUnavailableReason = 'DATABASE_URL not set'
    return null
  }

  if (raw.trim().startsWith('file:')) {
    _dbUnavailableReason = 'DATABASE_URL is SQLite (file:), but schema requires PostgreSQL.'
    return null
  }

  return normalizeUrl(raw)
}

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
      const poolUrl = dbUrl.includes('?')
        ? `${dbUrl}&connection_limit=3&pool_timeout=15`
        : `${dbUrl}?connection_limit=3&pool_timeout=15`

      // @neondatabase/serverless uses pure WebSocket/HTTP — no fs, net, tls, dns
      const sql = neon(poolUrl)
      const adapter = new PrismaNeon(sql)

      globalForPrisma.prisma = new PrismaClient({
        adapter,
        log: ['error', 'warn'],
      })
    }
    _rawPrisma = globalForPrisma.prisma
    _dbAvailable = true
  } else {
    _dbUnavailableReason = dbUrl ? 'Invalid database URL format (not PostgreSQL)' : 'No DATABASE_URL configured'
  }
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  _dbUnavailableReason = message
  console.error('[DB] Failed to initialize database client:', err)
}

export function isDatabaseAvailable(): boolean {
  return _dbAvailable
}

export function getDatabaseUnavailableReason(): string {
  return _dbUnavailableReason || 'Database not configured'
}

function createDbProxy(prisma: PrismaClient | undefined): PrismaClient {
  if (prisma) return prisma

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

export async function ensureSchema(): Promise<void> {
  // No-op
}
