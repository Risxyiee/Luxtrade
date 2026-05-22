import { PrismaClient } from '@prisma/client'

// Ensure DATABASE_URL is properly set for SQLite
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL
  
  // If DATABASE_URL is not set, use default SQLite path
  if (!url) {
    console.warn('⚠️ DATABASE_URL not set, using default SQLite path')
    return 'file:./db/custom.db'
  }
  
  // Ensure it starts with file: for SQLite
  if (!url.startsWith('file:')) {
    console.warn('⚠️ DATABASE_URL does not start with file:, fixing it')
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
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Log database URL in development for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('🗄️ Database URL:', getDatabaseUrl())
}
