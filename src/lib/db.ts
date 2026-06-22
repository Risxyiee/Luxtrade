import { PrismaClient } from '@prisma/client'

/**
 * Auto-convert PostgreSQL URL to Supavisor pooler (port 6543)
 * to prevent EMAXCONNSESSION errors on Supabase.
 * Direct port 5432 = max 15 sessions. Pooler 6543 = handles thousands.
 */
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL

  if (!url) {
    console.warn('⚠️ DATABASE_URL not set, using default SQLite path')
    return 'file:./db/custom.db'
  }

  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    // Check if already using pooler (port 6543) or has pgbouncer=true
    if (url.includes(':6543/') || url.includes('pgbouncer=true')) {
      console.log('🔗 [DB] PostgreSQL connection established (pooler)')
      return url
    }

    // Auto-convert direct connection to Supavisor pooler
    // Replace :5432 with :6543 and add pgbouncer=true + connection_limit
    const poolerUrl = url
      .replace(/:(5432|6432)\//, ':6543/')
      .replace(/pooler\.supabase\.com/, 'pooler.supabase.com')
    const separator = poolerUrl.includes('?') ? '&' : '?'
    const finalUrl = `${poolerUrl}${separator}pgbouncer=true&connection_limit=5&pool_timeout=10`

    console.log('🔗 [DB] PostgreSQL — auto-switched to Supavisor pooler (port 6543)')
    console.log('🔗 [DB] pgbouncer=true, connection_limit=5, pool_timeout=10')
    return finalUrl
  }

  // For SQLite
  if (!url.startsWith('file:')) {
    if (url.startsWith('/') || url.startsWith('./')) {
      return `file:${url}`
    }
    return `file:./${url}`
  }

  return url
}

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const dbUrl = getDatabaseUrl()
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: dbUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error', 'warn'],
  })

// Always store on globalThis to reuse across hot reloads
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Log database configuration on startup
const dbType = isPostgres ? 'PostgreSQL' : 'SQLite'

console.log('Database connected to:', process.env.DATABASE_URL ? 'OK' : 'MISSING')
console.log('🗄️ ============================================')
console.log(`🗄️ Database Type: ${dbType}`)
console.log(`🗄️ Environment: ${process.env.NODE_ENV || 'development'}`)

if (isPostgres) {
  const maskedUrl = dbUrl.replace(/:[^:]+@/, ':****@')
  console.log(`🗄️ Database URL: ${maskedUrl}`)
  console.log(`🗄️ Connection Pooling: ✅ Supavisor (pgbouncer=true, connection_limit=5)`)
} else {
  console.log(`🗄️ Database Path: ${dbUrl}`)
}
console.log('🗄️ ============================================')
