import { PrismaClient } from '@prisma/client'

/**
 * Database connection with URL normalization.
 * - Fixes common Vercel env var corruption (file prefix, doubled protocol)
 * - Auto-detects Supabase direct connection and converts to pooler
 * - Handles pgbouncer compatibility (pooler port, pgBouncer mode)
 * - Graceful fallback for local dev without proper database
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

const getDatabaseUrl = (): string => {
  const raw = process.env.DATABASE_URL

  if (!raw) {
    // In production, database is required
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production')
    }
    // Local dev: try to use env var, fall back gracefully
    return 'file:./db/custom.db'
  }

  // If it's a file: URL (SQLite for local dev), use as-is
  if (raw.trim().startsWith('file:')) {
    return raw.trim()
  }

  return normalizeUrl(raw)
}

// Singleton to prevent exhausting connections
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

try {
  const dbUrl = getDatabaseUrl()
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasourceUrl: dbUrl,
      log: isPostgres ? ['error', 'warn'] : [],
    })

    // Startup log
    console.log('🗄️ ============================================')
    console.log(`🗄️ Database Type: ${isPostgres ? "PostgreSQL" : "SQLite (local dev)"}`)
    console.log(`🗄️ Environment: ${process.env.NODE_ENV || 'development'}`)
    if (isPostgres) {
      const masked = dbUrl.replace(/:([^:@]+)@/, ':****@')
      console.log(`🗄️ Database URL: ${masked}`)
    } else {
      console.log(`🗄️ Database Path: ${dbUrl}`)
    }
    console.log('🗄️ ============================================')
  }
} catch (err) {
  console.error('⚠️ [DB] Failed to initialize database client:', err)
}

export const db = globalForPrisma.prisma!
