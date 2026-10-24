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
  let url = ''
  let anonKey = ''

  try {
    url = (await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')) || ''
  } catch {}
  try {
    anonKey = (await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')) || ''
  } catch {}

  // Extra fallback in case the CF chain failed but process.env works (local dev)
  if (!url) url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!anonKey) anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

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
