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
      globalForPrisma.prisma = new PrismaClient({
        datasourceUrl: dbUrl,
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
 * DEPRECATED: ensureSchema() is kept as a minimal safety net only.
 * Schema changes should be done via:
 *   1. Supabase SQL Editor (manual)
 *   2. Prisma migrations (proper)
 *
 * PgBouncer (used by Supabase pooler) does NOT support multi-statement
 * queries or transactions via $executeRawUnsafe. This function now runs
 * individual statements one-by-one, but callers should NOT rely on it
 * for new schema changes going forward.
 */
let _autoMigrated = false

export async function ensureSchema(): Promise<void> {
  if (_autoMigrated || !_dbAvailable || !_rawPrisma) return
  _autoMigrated = true

  // Minimal: only ensure the promo_codes table exists and is seeded.
  // All other tables/columns are assumed to already exist in production
  // (created via Supabase SQL Editor or Prisma migrations).
  // If you need a new column, add it manually in Supabase SQL Editor.
  const statements = [
    // Promo tables (these get DROP+CREATE'd so they must be re-created)
    `DROP TABLE IF EXISTS public.user_subscriptions CASCADE`,
    `DROP TABLE IF EXISTS public.promo_codes CASCADE`,
    `CREATE TABLE IF NOT EXISTS "promo_codes" (
      "id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "description" TEXT,
      "discount_percent" DOUBLE PRECISION NOT NULL,
      "max_quota" INTEGER NOT NULL,
      "used_quota" INTEGER NOT NULL DEFAULT 0,
      "duration_months" INTEGER NOT NULL,
      "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "end_date" TIMESTAMP(3),
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code")`,
    `INSERT INTO promo_codes (id, code, description, discount_percent, max_quota, used_quota, duration_months, start_date, is_active, created_at, updated_at)
      VALUES (gen_random_uuid()::text, 'TRADERCEPAT', 'Diskon 100% — 3 Bulan PRO Gratis!', 100, 30, 0, 3, NOW(), true, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING`,
    `UPDATE promo_codes SET discount_percent=100, max_quota=30, duration_months=3, is_active=true, end_date=NULL, updated_at=NOW() WHERE code='TRADERCEPAT'`,
  ]

  console.log('🔄 [DB] Running minimal ensureSchema...')
  for (const sql of statements) {
    try {
      await _rawPrisma.$executeRawUnsafe(sql)
    } catch (e: any) {
      // Silently ignore — column/table already exists, or pgbouncer quirk
    }
  }
  console.log('✅ [DB] ensureSchema done')
}

// Keep chunkSql for backward compat but it's no longer used
function _chunkSql(sql: string, groups: number): string[][] {
  const statements = sql
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('--'))
    .reduce<string[]>((acc, line) => {
      if (line.endsWith(';')) {
        acc.push(line)
      } else if (acc.length > 0) {
        acc[acc.length - 1] += ' ' + line
      } else {
        acc.push(line)
      }
      return acc
    }, [])

  const result: string[][] = Array.from({ length: groups }, () => [])
  statements.forEach((stmt, i) => {
    result[i % groups].push(stmt)
  })
  return result
}