import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Create Prisma client
let prismaInstance: PrismaClient | null = null

function createPrismaClient() {
  try {
    // Check if DATABASE_URL is properly configured
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      console.warn('⚠️ DATABASE_URL is not configured. Prisma will not be available.')
      return null
    }

    // Check if database URL is valid (must start with file: for SQLite)
    if (databaseUrl && !databaseUrl.startsWith('file:')) {
      console.warn('⚠️ DATABASE_URL is invalid (must start with "file:"). Prisma will not be available.')
      return null
    }

    const client = new PrismaClient()
    console.log('✅ Prisma client initialized successfully')
    return client
  } catch (error) {
    console.error('❌ Failed to initialize Prisma client:', error)
    return null
  }
}

export const db = prismaInstance || (prismaInstance = createPrismaClient())

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// Export helper to check if Prisma is available
export function isPrismaAvailable(): boolean {
  return db !== null
}
