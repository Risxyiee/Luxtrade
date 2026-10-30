import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Try to read a secret from CF Workers env, then process.env.
 * On CF Workers, secrets set via `wrangler secret put` are in the env object,
 * not necessarily in process.env at module-init time.
 *
 * FIX: Added globalThis[Symbol.for('__cloudflare-context__')].env check
 * (same as centralized getEnvVar in cloudflare-bindings.ts) — this is the
 * MOST reliable path in CF Workers production where worker-entry.ts sets the
 * context before delegating to OpenNext. Without this, SUPABASE_SERVICE_ROLE_KEY
 * is not found, admin client is null, and RLS blocks PATCH/DELETE operations.
 */
async function getSecret(key: string): Promise<string | undefined> {
  // 0. Try direct globalThis access FIRST (most reliable in CF Workers production)
  //    worker-entry.ts sets globalThis[Symbol.for('__cloudflare-context__')] = { env, cf, ctx }
  //    before delegating to OpenNext. This is the most direct path to secrets.
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as any)[sym]
    if (ctx?.env) {
      const val = (ctx.env as any)[key]
      if (typeof val === 'string' && val.length > 0) return val
    }
  } catch {}

  // 1. Try process.env (fast, works if OpenNext populated it)
  if (process.env[key]) return process.env[key]

  // 2. Try CF Workers env via getCloudflareContext
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    try {
      const ctx = await getCloudflareContext({ async: true });
      if (ctx?.env) {
        const val = (ctx.env as any)[key];
        if (typeof val === 'string' && val.length > 0) return val;
      }
    } catch {}
    try {
      const ctx = getCloudflareContext();
      if (ctx?.env) {
        const val = (ctx.env as any)[key];
        if (typeof val === 'string' && val.length > 0) return val;
      }
    } catch {}
  } catch {}

  // 3. Last resort: globalThis.__env__ or globalThis.env (some CF Workers setups)
  try {
    const globalEnv = (globalThis as any).__env__ || (globalThis as any).env;
    if (globalEnv) {
      const val = globalEnv[key];
      if (typeof val === 'string' && val.length > 0) return val;
    }
  } catch {}

  return undefined;
}

/**
 * DIAGNOSA KEY (2026-10-30): decode payload JWT dan baca klaim `role`
 * TANPA membuka secret — klaim role bukan rahasia (anon/service_role).
 * Kasus nyata: key ANON terpaste sebagai SUPABASE_SERVICE_ROLE_KEY → semua
 * operasi admin gagal 42501 (RLS) padahal "key ada" — sulit didiagnosis dari
 * log generik. Dengan ini log CF langsung menyebut akar masalahnya.
 *
 * Returns: 'service_role' | 'anon' | 'unknown_role' | 'non_jwt'
 */
export function diagnoseServiceKey(key: string): {
  kind: 'service_role' | 'anon' | 'unknown_role' | 'non_jwt'
  ref?: string
} {
  try {
    const parts = key.split('.')
    if (parts.length !== 3) return { kind: 'non_jwt' } // mis. sb_secret_... (format baru)
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(b64, 'base64').toString('utf8')
        : atob(b64)
    const payload = JSON.parse(json) as { role?: string; ref?: string }
    if (payload.role === 'service_role') return { kind: 'service_role', ref: payload.ref }
    if (payload.role === 'anon') return { kind: 'anon', ref: payload.ref }
    return { kind: 'unknown_role', ref: payload.ref }
  } catch {
    return { kind: 'non_jwt' }
  }
}

/**
 * Create a Supabase admin client with SERVICE_ROLE_KEY.
 * This client has full access to bypass RLS policies and perform admin operations.
 * WARNING: Only use this on the server side, never expose to the client.
 *
 * CRITICAL: Returns null if SUPABASE_SERVICE_ROLE_KEY is not available.
 * On Cloudflare Workers, env vars are only available at request time.
 * Callers MUST check for null return value.
 *
 * @returns Supabase client with admin privileges, or null if key not available
 */
export function createAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    // During build time, env vars may not be available — return null
    return null
  }

  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseServiceKey) {
    // On CF Workers, the service role key must be set as a secret
    // If missing, all admin operations will fail — return null so callers can detect
    return null
  }

  // Guard salah-pasang-key (lihat diagnoseServiceKey di atas)
  const diag = diagnoseServiceKey(supabaseServiceKey)
  if (diag.kind === 'anon') {
    console.error(
      '[supabase/admin] FATAL MISCONFIG: SUPABASE_SERVICE_ROLE_KEY berisi ANON key (role="anon")' +
        (diag.ref ? ` ref=${diag.ref}` : '') +
        ' — semua operasi admin akan gagal 42501 (RLS). Fix: Supabase → API Keys → tab KANAN "Legacy anon, service_role" → copy key service_role → Cloudflare → Settings → Variables & Secrets.'
    )
    return null
  }
  if (diag.kind === 'non_jwt') {
    console.warn('[supabase/admin] Service key bukan JWT legacy (kemungkinan format baru sb_secret_) — diteruskan apa adanya.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Create a Supabase admin client asynchronously, checking CF Workers env as fallback.
 * This is the PREFERRED way to create admin clients in API route handlers,
 * where CF Workers env may be available even if process.env is not populated.
 */
export async function createAdminClientAsync(): Promise<SupabaseClient | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || await getSecret('NEXT_PUBLIC_SUPABASE_URL')

  if (!supabaseUrl) {
    return null
  }

  const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseServiceKey) {
    console.warn('[supabase/admin] SUPABASE_SERVICE_ROLE_KEY not found in process.env or CF ctx.env')
    return null
  }

  // Guard salah-pasang-key (lihat diagnoseServiceKey di atas)
  const diag = diagnoseServiceKey(supabaseServiceKey)
  if (diag.kind === 'anon') {
    console.error(
      '[supabase/admin] FATAL MISCONFIG: SUPABASE_SERVICE_ROLE_KEY (dari CF ctx.env) berisi ANON key (role="anon")' +
        (diag.ref ? ` ref=${diag.ref}` : '') +
        ' — semua operasi admin akan gagal 42501 (RLS). Fix: Supabase → API Keys → tab KANAN "Legacy anon, service_role" → copy key service_role → Cloudflare → Settings → Variables & Secrets.'
    )
    return null
  }
  if (diag.kind === 'non_jwt') {
    console.warn('[supabase/admin] Service key bukan JWT legacy (kemungkinan format baru sb_secret_) — diteruskan apa adanya.')
  }

  console.log(
    '[supabase/admin] Created admin client with key from',
    process.env.SUPABASE_SERVICE_ROLE_KEY ? 'process.env' : 'CF ctx.env',
    `— role=${diag.kind}`
  )

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Get the admin Auth API from a Supabase client.
 * Uses `as any` to bypass Turbopack type resolution issues with .auth.admin chain.
 * At runtime, this is fully valid — supabase-js v2 exposes auth.admin on service role clients.
 */
export function getSupabaseAdminAuth(client: ReturnType<typeof createClient>) {
  return (client.auth as any).admin
}
