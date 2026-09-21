import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

export function isDatabaseAvailable(): boolean {
  return !!db
}

export function getDatabaseUnavailableReason(): string {
  return 'Database is not configured'
}

export async function ensureSchema(): Promise<void> {
  // No-op for now - schema is managed by Prisma migrations
}

export default db
