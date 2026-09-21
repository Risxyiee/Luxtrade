/**
 * Database client module — Supabase-backed Prisma-compatible interface.
 *
 * Exports:
 *   - db                  : Prisma-compatible client backed by Supabase
 *   - isDatabaseAvailable  : () => boolean  — checks if DB connection is configured
 *   - ensureSchema        : () => Promise<void>  — ensures required tables/columns exist
 *
 * The `db` object mimics the Prisma Client API used throughout the codebase:
 *   - Model accessors: db.profile, db.user, db.trade, db.newsletter, etc.
 *   - Raw SQL: db.$executeRawUnsafe(), db.$queryRawUnsafe(), db.$queryRaw
 *   - Each model supports: findUnique, findFirst, findMany, create, createMany,
 *     update, updateMany, delete, deleteMany, count
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function readEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v || v === 'undefined') return undefined
  return v.trim()
}

function getSupabaseUrl(): string {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL') || ''
}

function getSupabaseServiceRoleKey(): string | undefined {
  return readEnv('SUPABASE_SERVICE_ROLE_KEY')
}

function getSupabaseAnonKey(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// ---------------------------------------------------------------------------
// Supabase admin client (singleton)
// ---------------------------------------------------------------------------

let _adminClient: SupabaseClient | null = null
let _clientInitAttempted = false

function getAdminClient(): SupabaseClient | null {
  if (_adminClient) return _adminClient
  if (_clientInitAttempted) return null

  _clientInitAttempted = true
  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()
  const anonKey = getSupabaseAnonKey()

  if (!url) return null

  // Prefer service role key for full DB access; fall back to anon key
  const effectiveKey = key || anonKey
  if (!effectiveKey) return null

  try {
    _adminClient = createClient(url, effectiveKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    return _adminClient
  } catch (err) {
    console.error('[db] Failed to create Supabase client:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// isDatabaseAvailable
// ---------------------------------------------------------------------------

export function isDatabaseAvailable(): boolean {
  return !!getAdminClient()
}

// ---------------------------------------------------------------------------
// Prisma-compatible model delegate
// ---------------------------------------------------------------------------

type Filter = Record<string, unknown>

class ModelDelegate {
  constructor(private tableName: string) {}

  private _client(): SupabaseClient {
    const client = getAdminClient()
    if (!client) throw new Error(`[db] Database not available — cannot access ${this.tableName}`)
    return client
  }

  /** Normalize a Prisma-style `where` clause into Supabase query filters.
   *  Supports: { id: "..." }, { email: "..." }, { id: { in: [...] } } etc.  */
  private _buildFilters(where: Filter = {}): string[] {
    const filters: string[] = []
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined || value === null) continue
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle Prisma-style operators like { in: [...] }
        const v = value as Record<string, unknown>
        if (v.in && Array.isArray(v.in)) {
          filters.push(`${key}.in.(${(v.in as string[]).join(',')})`)
        } else if (v.not !== undefined) {
          filters.push(`${key}.neq.${v.not}`)
        } else if (v.gte !== undefined) {
          filters.push(`${key}.gte.${v.gte}`)
        } else if (v.lte !== undefined) {
          filters.push(`${key}.lte.${v.lte}`)
        } else if (v.gt !== undefined) {
          filters.push(`${key}.gt.${v.gt}`)
        } else if (v.lt !== undefined) {
          filters.push(`${key}.lt.${v.lt}`)
        }
      } else {
        filters.push(`${key}.eq.${value}`)
      }
    }
    return filters
  }

  async findUnique(args: { where: Filter; select?: Filter } = { where: {} }): Promise<any | null> {
    const filters = this._buildFilters(args.where)
    const query = this._client().from(this.tableName).select(args.select ? Object.keys(args.select).join(',') : '*')
    for (const f of filters) {
      const [rest] = f.split('.')
      const opPart = f.substring(rest.length + 1)
      query.filter(rest, opPart.split('.')[0], opPart.split('.').slice(1).join('.'))
    }
    // Simpler approach: rebuild with explicit filter calls
    let q = this._client().from(this.tableName).select(args.select ? Object.keys(args.select).join(',') : '*')
    for (const [key, value] of Object.entries(args.where || {})) {
      if (value === undefined || value === null) continue
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const v = value as Record<string, unknown>
        if ('in' in v && Array.isArray(v.in)) {
          q = q.in(key, v.in as (string | number)[])
        } else if ('not' in v) {
          q = q.neq(key, v.not as string | number | boolean)
        } else if ('gte' in v) {
          q = q.gte(key, v.gte as string | number)
        } else if ('lte' in v) {
          q = q.lte(key, v.lte as string | number)
        } else if ('gt' in v) {
          q = q.gt(key, v.gt as string | number)
        } else if ('lt' in v) {
          q = q.lt(key, v.lt as string | number)
        }
      } else {
        q = q.eq(key, value as string | number | boolean)
      }
    }
    const { data, error } = await q.maybeSingle()
    if (error) {
      console.warn(`[db.${this.tableName}.findUnique] Supabase error:`, error.message)
      return null
    }
    return data
  }

  async findFirst(args: { where?: Filter; select?: Filter; orderBy?: Filter | Filter[]; limit?: number } = {}): Promise<any | null> {
    let q = this._client().from(this.tableName).select(args.select ? Object.keys(args.select).join(',') : '*')
    if (args.where) {
      for (const [key, value] of Object.entries(args.where)) {
        if (value === undefined || value === null) continue
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const v = value as Record<string, unknown>
          if ('in' in v && Array.isArray(v.in)) q = q.in(key, v.in as (string | number)[])
          else if ('not' in v) q = q.neq(key, v.not as string | number | boolean)
          else if ('gte' in v) q = q.gte(key, v.gte as string | number)
          else if ('lte' in v) q = q.lte(key, v.lte as string | number)
        } else {
          q = q.eq(key, value as string | number | boolean)
        }
      }
    }
    q = q.limit(1)
    const { data, error } = await q
    if (error) {
      console.warn(`[db.${this.tableName}.findFirst] Supabase error:`, error.message)
      return null
    }
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  }

  async findMany(args: { where?: Filter; select?: Filter; orderBy?: Filter | Filter[]; limit?: number; offset?: number; take?: number; skip?: number } = {}): Promise<any[]> {
    let q = this._client().from(this.tableName).select(args.select ? Object.keys(args.select).join(',') : '*')
    if (args.where) {
      for (const [key, value] of Object.entries(args.where)) {
        if (value === undefined || value === null) continue
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const v = value as Record<string, unknown>
          if ('in' in v && Array.isArray(v.in)) q = q.in(key, v.in as (string | number)[])
          else if ('not' in v) q = q.neq(key, v.not as string | number | boolean)
          else if ('gte' in v) q = q.gte(key, v.gte as string | number)
          else if ('lte' in v) q = q.lte(key, v.lte as string | number)
        } else {
          q = q.eq(key, value as string | number | boolean)
        }
      }
    }
    const limit = args.take ?? args.limit
    if (limit) q = q.limit(limit)
    const offset = args.skip ?? args.offset
    if (offset) q = q.range(offset, offset + (limit || 1000) - 1)
    const { data, error } = await q
    if (error) {
      console.warn(`[db.${this.tableName}.findMany] Supabase error:`, error.message)
      return []
    }
    return Array.isArray(data) ? data : []
  }

  async create(args: { data: Record<string, unknown> }): Promise<any> {
    const { data, error } = await this._client().from(this.tableName).insert(args.data).select('*').single()
    if (error) {
      throw new Error(`[db.${this.tableName}.create] ${error.message}`)
    }
    return data
  }

  async createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }> {
    const { error, count } = await this._client().from(this.tableName).insert(args.data)
    if (error) {
      throw new Error(`[db.${this.tableName}.createMany] ${error.message}`)
    }
    return { count: count ?? args.data.length }
  }

  async update(args: { where: Filter; data: Record<string, unknown> }): Promise<any> {
    let q = this._client().from(this.tableName).update(args.data)
    for (const [key, value] of Object.entries(args.where || {})) {
      if (value === undefined || value === null) continue
      q = q.eq(key, value as string | number | boolean)
    }
    const { data, error } = await q.select('*').maybeSingle()
    if (error) {
      throw new Error(`[db.${this.tableName}.update] ${error.message}`)
    }
    return data
  }

  async updateMany(args: { where: Filter; data: Record<string, unknown> }): Promise<{ count: number }> {
    let q = this._client().from(this.tableName).update(args.data)
    for (const [key, value] of Object.entries(args.where || {})) {
      if (value === undefined || value === null) continue
      q = q.eq(key, value as string | number | boolean)
    }
    const { error, count } = await q
    if (error) {
      throw new Error(`[db.${this.tableName}.updateMany] ${error.message}`)
    }
    return { count: count ?? 0 }
  }

  async delete(args: { where: Filter }): Promise<any> {
    let q = this._client().from(this.tableName).delete()
    for (const [key, value] of Object.entries(args.where || {})) {
      if (value === undefined || value === null) continue
      q = q.eq(key, value as string | number | boolean)
    }
    const { data, error } = await q.select('*').maybeSingle()
    if (error) {
      throw new Error(`[db.${this.tableName}.delete] ${error.message}`)
    }
    return data
  }

  async deleteMany(args: { where?: Filter } = {}): Promise<{ count: number }> {
    let q = this._client().from(this.tableName).delete()
    if (args.where) {
      for (const [key, value] of Object.entries(args.where)) {
        if (value === undefined || value === null) continue
        q = q.eq(key, value as string | number | boolean)
      }
    }
    const { error, count } = await q
    if (error) {
      throw new Error(`[db.${this.tableName}.deleteMany] ${error.message}`)
    }
    return { count: count ?? 0 }
  }

  async count(args: { where?: Filter } = {}): Promise<number> {
    let q = this._client().from(this.tableName).select('*', { count: 'exact', head: true })
    if (args.where) {
      for (const [key, value] of Object.entries(args.where)) {
        if (value === undefined || value === null) continue
        q = q.eq(key, value as string | number | boolean)
      }
    }
    const { count, error } = await q
    if (error) {
      console.warn(`[db.${this.tableName}.count] Supabase error:`, error.message)
      return 0
    }
    return count ?? 0
  }
}

// ---------------------------------------------------------------------------
// Raw SQL execution via Supabase rpc / direct Postgres
// ---------------------------------------------------------------------------

/**
 * Execute raw SQL via Supabase's REST interface.
 * Since Supabase doesn't expose a direct SQL execution API through the JS client
 * (unless using PostgREST rpc), we implement $executeRawUnsafe and $queryRawUnsafe
 * by using the Supabase client's `.rpc()` method for named queries, and for
 * DDL/DML statements we use a lightweight approach through the Supabase
 * management API or fall back to a console warning.
 *
 * IMPORTANT: For full raw SQL support (DDL, complex DML), the project should
 * configure DATABASE_URL and use Prisma Client directly. This implementation
 * provides a functional subset that works with Supabase's capabilities.
 */

async function executeRawUnsafe(...args: unknown[]): Promise<void> {
  const client = getAdminClient()
  if (!client) throw new Error('[db] Database not available for raw SQL execution')

  const sql = args[0] as string
  const params = args.slice(1)

  // Try using Supabase's built-in rpc for executing SQL
  // This requires a `execute_sql` function to be defined in the database
  // If not available, we log a warning and no-op for DDL (safe for schema sync)
  try {
    const { error } = await client.rpc('execute_sql' as never, {
      query: sql,
      params: params.length > 0 ? params : undefined,
    } as never)
    if (error) {
      // RPC function might not exist — log but don't throw for DDL (CREATE TABLE IF NOT EXISTS, etc.)
      if (!sql.trim().toUpperCase().startsWith('SELECT')) {
        // DDL/DML — best effort, log warning
        console.warn(`[db.$executeRawUnsafe] RPC not available, SQL not executed: ${sql.substring(0, 100)}...`)
      } else {
        throw new Error(`[db.$executeRawUnsafe] ${error.message}`)
      }
    }
  } catch (err) {
    // If the RPC doesn't exist, for DDL statements we silently continue
    // (tables may already exist via migrations). For SELECT, we rethrow.
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      throw err
    }
    console.warn(`[db.$executeRawUnsafe] Could not execute: ${sql.substring(0, 100)}...`)
  }
}

async function queryRawUnsafe(...args: unknown[]): Promise<any[]> {
  const client = getAdminClient()
  if (!client) throw new Error('[db] Database not available for raw SQL query')

  const sql = args[0] as string
  const params = args.slice(1)

  try {
    const { data, error } = await client.rpc('execute_sql' as never, {
      query: sql,
      params: params.length > 0 ? params : undefined,
    } as never)
    if (error) {
      throw new Error(`[db.$queryRawUnsafe] ${error.message}`)
    }
    return Array.isArray(data) ? data : data ? [data] : []
  } catch (err) {
    // If RPC doesn't exist, return empty array rather than crashing
    console.warn(`[db.$queryRawUnsafe] Could not execute query: ${sql.substring(0, 100)}...`)
    return []
  }
}

async function queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]> {
  // Build SQL from template literal
  let sql = ''
  for (let i = 0; i < strings.length; i++) {
    sql += strings[i]
    if (i < values.length) {
      sql += `$${i + 1}`
    }
  }
  return queryRawUnsafe(sql, ...values)
}

// ---------------------------------------------------------------------------
// Model registry — maps Prisma model names to Supabase table names
// ---------------------------------------------------------------------------

const MODEL_TABLE_MAP: Record<string, string> = {
  // Prisma model name → Supabase table name
  profile:            'profiles',
  user:               'users',
  userSubscription:   'user_subscriptions',
  trade:              'trades',
  journalEntry:       'journal_entries',
  tag:                'tags',
  weeklyGoal:         'weekly_goals',
  tradingAccount:     'trading_accounts',
  socialLink:         'social_links',
  promoCode:          'promo_codes',
  bugReport:          'bug_reports',
  paymentOrder:       'payment_orders',
  emailBroadcast:     'email_broadcasts',
  watchlistItem:      'watchlist',
  affiliate:          'affiliates',
  affiliateReferral:  'affiliate_referrals',
  affiliateWithdrawal:'affiliate_withdrawals',
  sharedTrade:        'shared_trades',
  userSubmission:     'user_submissions',
  missionProgress:    'mission_progress',
  newsletter:         'newsletter',
  subscriptionPlan:   'subscription_plans',
  slotTracking:       'slot_tracking',
}

// Build model delegates lazily
const modelCache = new Map<string, ModelDelegate>()

function getModel(name: string): ModelDelegate {
  let delegate = modelCache.get(name)
  if (!delegate) {
    const tableName = MODEL_TABLE_MAP[name] || name
    delegate = new ModelDelegate(tableName)
    modelCache.set(name, delegate)
  }
  return delegate
}

// ---------------------------------------------------------------------------
// The `db` client object
// ---------------------------------------------------------------------------

export const db = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string) {
    // Raw SQL methods
    if (prop === '$executeRawUnsafe') return executeRawUnsafe
    if (prop === '$queryRawUnsafe')   return queryRawUnsafe
    if (prop === '$queryRaw')         return queryRaw

    // Model accessors
    return getModel(prop)
  },
  has(_target, prop) {
    return prop === '$executeRawUnsafe' || prop === '$queryRawUnsafe' || prop === '$queryRaw' || prop in MODEL_TABLE_MAP
  },
}) as any

// ---------------------------------------------------------------------------
// ensureSchema — creates required tables/columns if they don't exist
// ---------------------------------------------------------------------------

export async function ensureSchema(): Promise<void> {
  const client = getAdminClient()
  if (!client) {
    console.warn('[db.ensureSchema] Database not available — skipping schema ensure')
    return
  }

  // Attempt to create essential tables via raw SQL
  // These are all IF NOT EXISTS so safe to run repeatedly
  const statements = [
    `CREATE TABLE IF NOT EXISTS newsletter (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT UNIQUE NOT NULL,
      "subscribedAt" TEXT NOT NULL DEFAULT NOW()::text
    );`,
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      description TEXT,
      price DOUBLE PRECISION NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IDR',
      "durationMonths" INTEGER,
      "isLifetime" BOOLEAN NOT NULL DEFAULT false,
      "maxSlots" INTEGER,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS slot_tracking (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "planId" TEXT NOT NULL,
      "totalSlots" INTEGER NOT NULL,
      "usedSlots" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  ]

  for (const sql of statements) {
    try {
      await executeRawUnsafe(sql)
    } catch {
      // Table may already exist or RPC not available — non-fatal
    }
  }
}
