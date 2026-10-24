import { NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'

/**
 * Returns Supabase connection config for client-side initialization (login, dashboard, etc).
 * The anon key is public (NEXT_PUBLIC_) so it's safe to expose.
 *
 * IMPORTANT: On Cloudflare Workers, `process.env` is not reliably populated at
 * runtime — this route previously returned empty strings, which made the login
 * page fail with "Gagal memuat Supabase". We now resolve env vars through the
 * centralized getEnvVar() chain (globalThis CF context → getCloudflareContext →
 * process.env), the same mechanism used by every other working route.
 */
export async function GET() {
  // 1. NEXT_PUBLIC_* vars are statically inlined by Next.js at BUILD time —
  //    direct (static) access is the most reliable source on CF Workers AND
  //    local dev. NOTE: dynamic lookups like process.env[key] inside getEnvVar()
  //    can NOT see these inlined values on Workers, which caused the noisy
  //    "[getEnvVar] NEXT_PUBLIC_SUPABASE_URL NOT FOUND" warns. So we only fall
  //    back to getEnvVar() for non-prefixed binding names below.
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // 2. Fallback: non-prefixed binding names via getEnvVar chain
  //    (CF ctx.env → process.env → globalThis) — no NEXT_PUBLIC_ warn noise.
  try { if (!url) url = (await getEnvVar('SUPABASE_URL')) || '' } catch {}
  try { if (!anonKey) anonKey = (await getEnvVar('SUPABASE_ANON_KEY')) || '' } catch {}

  // 3. Last resort: getEnvVar with NEXT_PUBLIC_ names (only reached when the
  //    build-time inline is missing entirely, e.g. misconfigured build — in
  //    that case the warn is legitimate).
  try { if (!url) url = (await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')) || '' } catch {}
  try { if (!anonKey) anonKey = (await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')) || '' } catch {}

  return NextResponse.json(
    {
      url,
      anonKey,
      isConfigured: !!(url && anonKey),
      source: anonKey ? 'env' : 'missing',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
