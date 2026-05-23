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
    // For production, ensure connection pooling is enabled
    if (process.env.NODE_ENV === 'production') {
      // Check if already has connection pooling parameters
      if (!url.includes('pgbouncer=true')) {
        // Replace port 5432 with 6543 for connection pooling
        let poolerUrl = url

        // If using direct port 5432, switch to pooler port 6543
        if (poolerUrl.includes(':5432/')) {
          poolerUrl = poolerUrl.replace(':5432/', ':6543/')
        }

        // Add pgbouncer=true parameter
        const separator = poolerUrl.includes('?') ? '&' : '?'
        poolerUrl = poolerUrl + separator + 'pgbouncer=true'

        console.log('🔗 Production: Using connection pooling (port 6543 with pgbouncer=true)')
        return poolerUrl
      }
    }

    return url // Use PostgreSQL URL as-is
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
const dbType = dbUrl.startsWith('postgresql://') ? 'PostgreSQL' : 'SQLite'
console.log('🗄️ ============================================')
console.log(`🗄️ Database Type: ${dbType}`)
console.log(`🗄️ Environment: ${process.env.NODE_ENV || 'development'}`)

if (dbType === 'PostgreSQL') {
  const maskedUrl = dbUrl.replace(/:[^:]+@/, ':****@')
  console.log(`🗄️ Database URL: ${maskedUrl}`)
  if (dbUrl.includes('pgbouncer=true')) {
    console.log(`🗄️ Connection Pooling: ✅ Enabled (pgbouncer)`)
  } else if (process.env.NODE_ENV === 'production') {
    console.log(`⚠️ Connection Pooling: ❌ Not enabled (add ?pgbouncer=true)`)
  }
} else {
  console.log(`🗄️ Database Path: ${dbUrl}`)
}
console.log('🗄️ ============================================')
