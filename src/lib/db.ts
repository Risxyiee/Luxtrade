import { PrismaClient } from '@prisma/client'

/**
 * Database connection with auto Supavisor pooler support.
 * - PostgreSQL URLs are auto-converted to pooler port 6543
 * - Tolerates malformed URLs (e.g. double protocol prefix)
 * - Falls back to SQLite when DATABASE_URL is not a valid postgres URL
 */

function normalizeUrl(raw: string): string {
  // Trim whitespace
  let url = raw.trim()

  // Fix common Vercel env var corruption:
  // Sometimes the URL gets a stray "file:./" prepended by a previous deploy
  // or a "p" gets doubled: "ppostgresql://..."
  if (url.startsWith('file:./') && url.includes('postgresql://')) {
    url = url.replace(/^file:\.\/?/, '')
  }
  if (url.startsWith('file:') && url.includes('postgresql://')) {
    url = url.replace(/^file:/, '')
  }

  // Fix doubled protocol prefix (e.g. "ppostgresql://")
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://') && url.includes('postgresql://')) {
    url = url.substring(url.indexOf('postgresql://'))
  }
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://') && url.includes('postgres://')) {
    url = url.substring(url.indexOf('postgres://'))
  }

  return url
}

const getDatabaseUrl = (): { url: string; isPostgres: boolean } => {
  const raw = process.env.DATABASE_URL

  if (!raw) {
    return { url: 'file:./db/custom.db', isPostgres: false }
  }

  const url = normalizeUrl(raw)

  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    // Check if already using pooler (port 6543) or has pgbouncer=true
    if (url.includes(':6543/') || url.includes('pgbouncer=true')) {
      return { url, isPostgres: true }
    }

    // Auto-convert direct connection to Supavisor pooler
    const poolerUrl = url.replace(/:(5432|6432)\//, ':6543/')
    const separator = poolerUrl.includes('?') ? '&' : '?'
    const finalUrl = `${poolerUrl}${separator}pgbouncer=true&connection_limit=5&pool_timeout=10`

    return { url: finalUrl, isPostgres: true }
  }

  // For SQLite
  if (url.startsWith('file:')) {
    return { url, isPostgres: false }
  }

  // If it looks like a relative path
  if (url.startsWith('/') || url.startsWith('./')) {
    return { url: `file:${url}`, isPostgres: false }
  }

  // Unknown format — return as-is and let Prisma validate
  return { url, isPostgres: false }
}

// Singleton to prevent exhausting connections across hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const { url: dbUrl, isPostgres } = getDatabaseUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: dbUrl,
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Startup log
console.log('Database connected to:', process.env.DATABASE_URL ? 'OK' : 'MISSING')
console.log('🗄️ ============================================')
console.log(`🗄️ Database Type: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`)
console.log(`🗄️ Environment: ${process.env.NODE_ENV || 'development'}`)

if (isPostgres) {
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@')
  console.log(`🗄️ Database URL: ${maskedUrl}`)
  console.log('🗄️ Connection Pooling: ✅ Supavisor (pgbouncer=true, connection_limit=5)')
} else {
  console.log(`🗄️ Database Path: ${dbUrl}`)
}
console.log('🗄️ ============================================')
