import { PrismaClient } from '@prisma/client'

/**
 * Database connection with URL normalization.
 * - Fixes common Vercel env var corruption (file prefix, doubled protocol)
 * - Passes URL to Prisma AS-IS (no auto port conversion)
 * - User should use the exact URL from Supabase Dashboard → Settings → Database
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

  return url
}

const getDatabaseUrl = (): string => {
  const raw = process.env.DATABASE_URL

  if (!raw) {
    return 'file:./db/custom.db'
  }

  return normalizeUrl(raw)
}

// Singleton to prevent exhausting connections
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const dbUrl = getDatabaseUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: dbUrl,
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Startup log
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
console.log('Database connected to:', process.env.DATABASE_URL ? 'OK' : 'MISSING')
console.log('🗄️ ============================================')
console.log(`🗄️ Database Type: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`)
console.log(`🗄️ Environment: ${process.env.NODE_ENV || 'development'}`)

if (isPostgres) {
  // Mask password in log
  const masked = dbUrl.replace(/:([^:@]+)@/, ':****@')
  console.log(`🗄️ Database URL: ${masked}`)
} else {
  console.log(`🗄️ Database Path: ${dbUrl}`)
}
console.log('🗄️ ============================================')
