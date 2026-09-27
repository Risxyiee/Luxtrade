import { NextResponse } from 'next/server'

/**
 * Returns Supabase connection config for client-side initialization.
 * The anon key is public (NEXT_PUBLIC_) so it's safe to expose.
 * No hardcoded fallbacks — if env var is missing, the client must handle it.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  return NextResponse.json({
    url,
    anonKey,
    isConfigured: !!(url && anonKey),
    source: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'env' : 'missing'
  })
}
