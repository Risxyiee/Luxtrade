import { PrismaClient } from '@prisma/client'

/**
 * Cloudflare Workers guard for Prisma.
 *
 * WHY: Prisma's query engine calls fs.readdir / fs.existsSync at runtime to
 * locate its Rust binary. Cloudflare Workers (via unenv shims) throws:
 *   "[unenv] fs.readdir is not implemented yet!"
 *
 * Importing db.ts used to crash ANY route on Workers as soon as a query ran.
 * Now, on CF Workers we NEVER construct PrismaClient:
 *   - `db` becomes a stub Proxy that throws a clear, actionable error
 *   - `isDatabaseAvailable()` returns false so callers degrade gracefully
 *   - local dev (Node/bun) keeps the real PrismaClient unchanged
 *
 * All production data access must use the Supabase admin client
 * (@/lib/supabase/admin, @/lib/supabase) which works everywhere.
 */
function isCloudflareWorkers(): boolean {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).userAgent === 'Cloudflare-Workers') {
      return true
    }
    if (typeof (globalThis as any).WebSocketPair !== 'undefined') {
      return true
    }
  } catch {}
  return false
}

const onWorkers = isCloudflareWorkers()

const PRISMA_STUB_MESSAGE =
  '[db] Prisma is not available on Cloudflare Workers (its engine requires fs.readdir). ' +
  'Use the Supabase admin client (@/lib/supabase/admin) instead.'

/**
 * Recursive stub Proxy: any property chain (db.user.findMany(), db.$queryRaw`...`,
 * db.$transaction(...), etc.) throws the clear message above instead of crashing
 * with the unenv fs.readdir error.
 */
function createPrismaStub(path = 'db'): any {
  return new Proxy(function () {} as any, {
    get(_target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined
      return createPrismaStub(`${path}.${String(prop)}`)
    },
    apply() {
      throw new Error(`[db] ${path}: ${PRISMA_STUB_MESSAGE}`)
    },
    construct() {
      throw new Error(PRISMA_STUB_MESSAGE)
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = onWorkers
  ? createPrismaStub()
  : globalForPrisma.prisma ?? new PrismaClient()

if (!onWorkers && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

export function isDatabaseAvailable(): boolean {
  return !onWorkers && !!db
}

export function getDatabaseUnavailableReason(): string {
  return onWorkers
    ? 'Database (Prisma) is not available on Cloudflare Workers — use Supabase instead'
    : 'Database is not configured'
}

export async function ensureSchema(): Promise<void> {
  // No-op for now - schema is managed by Prisma migrations
}

export default db
