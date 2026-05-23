import { PrismaClient } from '@prisma/client'

// Get database URL and ensure it's properly formatted for environment
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL

  // If DATABASE_URL is not set, use default SQLite path for development
  if (!url) {
    console.warn('⚠️ DATABASE_URL not set, using default SQLite path')
    return 'file:./db/custom.db'
  }

  // Check if it's a PostgreSQL connection
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    // For production, automatically ensure port 6543 and pgbouncer=true
    if (process.env.NODE_ENV === 'production') {
      let prodUrl = url

      // Replace port 5432 with 6543 if needed
      if (prodUrl.includes(':5432/')) {
        prodUrl = prodUrl.replace(':5432/', ':6543/')
        console.log('🔧 [DB] Auto-switched to port 6543 for production')
      }

      // Add pgbouncer=true if not present
      if (!prodUrl.includes('pgbouncer=true')) {
        const separator = prodUrl.includes('?') ? '&' : '?'
        prodUrl = `${prodUrl}${separator}pgbouncer=true`
        console.log('🔧 [DB] Auto-added pgbouncer=true')
      }

      console.log('🔗 [DB] Production PostgreSQL with connection pooling')
      return prodUrl
    }
    return url // Use PostgreSQL URL as-is in development
  }

  // For SQLite, ensure it starts with file:
  if (!url.startsWith('file:')) {
    console.warn('⚠️ DATABASE_URL does not start with file:, fixing it for SQLite')
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

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Log database configuration on startup
const dbUrl = getDatabaseUrl()
const dbType = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') ? 'PostgreSQL' : 'SQLite'
console.log('🗄️ ============================================')
console.log(`🗄️ Database Type: ${dbType}`)
console.log(`🗄️ Environment: ${process.env.NODE_ENV || 'development'}`)

if (dbType === 'PostgreSQL') {
  // Mask password for security
  const maskedUrl = dbUrl.replace(/:[^:]+@/, ':****@')
  console.log(`🗄️ Database URL: ${maskedUrl}`)

  // Check for connection pooling
  if (dbUrl.includes('pgbouncer=true')) {
    console.log(`🗄️ Connection Pooling: ✅ Enabled (pgbouncer)`)
  } else if (dbUrl.includes(':6543/')) {
    console.log(`🗄️ Connection Pooling: ⚠️ Port 6543 used (pooler)`)
  } else if (dbUrl.includes(':5432/')) {
    console.log(`🗄️ Connection Pooling: ❌ Direct connection (port 5432)`)
  }
} else {
  console.log(`🗄️ Database Path: ${dbUrl}`)
}
console.log('🗄️ ============================================')
