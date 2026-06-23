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
      console.log(`🔄 [DB] Old: ${url.replace(/:([^@]+)@/, ':****@').substring(0, 80)}...`)
      console.log(`🔄 [DB] New: ${poolerUrl.replace(/:([^@]+)@/, ':****@').substring(0, 80)}...`)
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
    const masked = dbUrl.replace(/:([^:@]+)@/, ':****@')
    console.log(`🗄️ Database URL: ${masked}`)
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
 * Use this before any db operation to avoid runtime crashes.
 */
export function isDatabaseAvailable(): boolean {
  return _dbAvailable
}

/**
 * Get the reason why database is unavailable (for logging/error messages).
 */
export function getDatabaseUnavailableReason(): string {
  return _dbUnavailableReason || 'Database not configured'
}

/**
 * Creates a Proxy-based db wrapper that gracefully handles database unavailability.
 * Instead of crashing with "Cannot read properties of undefined", it throws a clear
 * error message indicating the database is not configured.
 * 
 * This allows all existing `db.xxx.findMany()` calls to work without modification —
 * they'll just get a clear error instead of a cryptic TypeError.
 */
function createDbProxy(prisma: PrismaClient | undefined): PrismaClient {
  if (prisma) return prisma

  // Return a Proxy that catches all access and throws a clear error
  return new Proxy({} as PrismaClient, {
    get(_target, prop, receiver) {
      // Allow inspection properties
      if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
        return () => '[DB Unavailable]'
      }
      if (typeof prop === 'string' && (prop === 'then' || prop === 'toJSON')) {
        return undefined
      }

      // For any Prisma model/method access, throw clear error
      return new Proxy({}, {
        get(_, methodProp) {
          return (...args: any[]) => {
            throw new Error(
              `Database is not available (${_dbUnavailableReason || 'no DATABASE_URL'}). ` +
              `Cannot execute db.${String(prop)}.${String(methodProp)}(). ` +
              `Please set DATABASE_URL to a PostgreSQL connection string.`
            )
          }
        }
      })
    }
  })
}

/**
 * Prisma Client instance. Safe to use in all environments.
 * - Production: connects to PostgreSQL (Supabase)
 * - Local dev without DB: returns a proxy that throws clear error messages
 *   instead of cryptic "Cannot read properties of undefined" crashes
 */
export const db: PrismaClient = createDbProxy(_rawPrisma)

/**
 * Auto-migration: creates missing tables/columns on first DB connection.
 * Uses CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS — safe to run repeatedly.
 * Runs once per process lifetime (singleton flag).
 */
let _autoMigrated = false

export async function ensureSchema(): Promise<void> {
  if (_autoMigrated || !_dbAvailable || !_rawPrisma) return
  _autoMigrated = true

  const tables = [
    `CREATE TABLE IF NOT EXISTS "email_broadcasts" (
      "id" TEXT NOT NULL,
      "target" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "sent_count" INTEGER NOT NULL DEFAULT 0,
      "failed_count" INTEGER NOT NULL DEFAULT 0,
      "sent_by" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "email_broadcasts_pkey" PRIMARY KEY ("id")
    );`,
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
    );`,
    `CREATE TABLE IF NOT EXISTS "user_subscriptions" (
      "id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "plan" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "end_date" TIMESTAMP(3),
      "promo_code_id" TEXT,
      "discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "payment_orders" (
      "id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "invoice_number" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'IDR',
      "plan" TEXT NOT NULL,
      "duration_months" INTEGER,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "payment_method" TEXT,
      "payment_channel" TEXT,
      "doku_transaction_id" TEXT,
      "doku_payment_url" TEXT,
      "customer_name" TEXT NOT NULL,
      "customer_email" TEXT NOT NULL,
      "paid_at" TIMESTAMP(3),
      "expired_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "bug_reports" (
      "id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "screenshot_url" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "withdrawals" (
      "id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "bank_name" TEXT NOT NULL,
      "bank_account" TEXT NOT NULL,
      "bank_holder" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "admin_note" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE TABLE IF NOT EXISTS "social_links" (
      "id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "platform" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "username" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "reviewed_by" TEXT,
      "reviewed_at" TIMESTAMP(3),
      "rejection_reason" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
    );`,
  ]

  const profileColumns = [
    `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verify_token" TEXT;`,
    `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verify_exp_at" TIMESTAMP(3);`,
    `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "my_referral_code" TEXT;`,
    `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "referred_by_code" TEXT;`,
    `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "has_ever_been_pro" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "commission_paid" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "device_id" TEXT;`,
  ]

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "profiles_email_verify_token_key" ON "profiles"("email_verify_token");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "profiles_my_referral_code_key" ON "profiles"("my_referral_code");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");`,
    `CREATE INDEX IF NOT EXISTS "promo_codes_is_active_start_date_end_date_idx" ON "promo_codes"("is_active", "start_date", "end_date");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_invoice_number_key" ON "payment_orders"("invoice_number");`,
  ]

  try {
    console.log('🔄 [DB] Running auto-migration (ensureSchema)...')
    for (const sql of tables) {
      try { await _rawPrisma.$executeRawUnsafe(sql) } catch (e: any) {
        if (!e?.message?.includes('already exists')) console.warn('⚠️ [DB] Table create:', e.message?.substring(0, 100))
      }
    }
    for (const sql of profileColumns) {
      try { await _rawPrisma.$executeRawUnsafe(sql) } catch (_e) { /* already exists = ok */ }
    }
    for (const sql of indexes) {
      try { await _rawPrisma.$executeRawUnsafe(sql) } catch (_e) { /* already exists = ok */ }
    }
    console.log('✅ [DB] Auto-migration complete')
  } catch (err) {
    console.error('⚠️ [DB] Auto-migration had issues (non-critical):', err)
  }
}
