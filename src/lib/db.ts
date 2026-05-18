import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient | any }

// Safe Prisma client that handles connection errors gracefully
let prismaInstance: PrismaClient | any = null

function createSafePrismaClient() {
  try {
    // Check if DATABASE_URL is properly configured
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      console.warn('⚠️ DATABASE_URL is not configured. Using mock Prisma client.')
      return createMockPrismaClient()
    }

    // Check if database URL is valid (must start with file: for SQLite)
    if (databaseUrl && !databaseUrl.startsWith('file:')) {
      console.warn('⚠️ DATABASE_URL is invalid (must start with "file:"). Using mock Prisma client.')
      return createMockPrismaClient()
    }

    const client = new PrismaClient()
    console.log('✅ Prisma client initialized successfully')
    return client
  } catch (error) {
    console.error('❌ Failed to initialize Prisma client, using mock:', error)
    return createMockPrismaClient()
  }
}

// Create a mock Prisma client that returns safe defaults
function createMockPrismaClient() {
  const createMockModel = (modelName: string) => ({
    findUnique: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.findUnique() called - returning null`)
      return null
    },
    findFirst: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.findFirst() called - returning null`)
      return null
    },
    findMany: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.findMany() called - returning empty array`)
      return []
    },
    create: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.create() called - no data will be saved`)
      return { id: 'mock-id', createdAt: new Date() }
    },
    update: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.update() called - no data will be updated`)
      return { id: 'mock-id', updatedAt: new Date() }
    },
    delete: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.delete() called - no data will be deleted`)
      return { id: 'mock-id' }
    },
    count: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.count() called - returning 0`)
      return 0
    },
    upsert: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.upsert() called - no data will be saved`)
      return { id: 'mock-id', createdAt: new Date() }
    },
    deleteMany: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.deleteMany() called - returning { count: 0 }`)
      return { count: 0 }
    },
    updateMany: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.updateMany() called - returning { count: 0 }`)
      return { count: 0 }
    },
    createMany: async (args?: any) => {
      console.warn(`⚠️ Mock Prisma: ${modelName}.createMany() called - no data will be saved`)
      return { count: 0 }
    },
  })

  return {
    user: createMockModel('user'),
    profile: createMockModel('profile'),
    userSubmission: createMockModel('userSubmission'),
    missionProgress: createMockModel('missionProgress'),
    userSubscription: createMockModel('userSubscription'),
    withdrawal: createMockModel('withdrawal'),
    pageVisit: createMockModel('pageVisit'),
    trades: createMockModel('trades'),
    $queryRaw: async (...args: any[]) => {
      console.warn('⚠️ Mock Prisma: $queryRaw called - returning empty array')
      return []
    },
    $executeRaw: async (...args: any[]) => {
      console.warn('⚠️ Mock Prisma: $executeRaw called - returning 0')
      return 0
    },
    $executeRawUnsafe: async (...args: any[]) => {
      console.warn('⚠️ Mock Prisma: $executeRawUnsafe called - returning 0')
      return 0
    },
    $transaction: async (callback: any) => {
      console.warn('⚠️ Mock Prisma: $transaction called - running without database')
      return await callback()
    },
    $connect: async () => {
      console.log('Mock Prisma: connect called')
    },
    $disconnect: async () => {
      console.log('Mock Prisma: disconnect called')
    },
  }
}

export const db = prismaInstance || (prismaInstance = createSafePrismaClient())

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// Export helper to check if Prisma is available
export function isPrismaAvailable(): boolean {
  return db !== null && typeof db !== 'object' || db?user?.findUnique !== undefined
}
