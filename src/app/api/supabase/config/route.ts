import { NextResponse } from 'next/server'

/**
 * API endpoint to retrieve Supabase configuration for client-side use.
 * This is safe because only the anon key (public) is exposed.
 */
export async function GET() {
  // Try multiple ways to access env vars for Cloudflare Workers
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'

  // Cloudflare Workers: check both process.env and global env
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                   (globalThis as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                   (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!anonKey) {
    console.error('[Supabase Config] NEXT_PUBLIC_SUPABASE_ANON_KEY not found')
    console.error('[Supabase Config] Available env vars:', Object.keys(process.env || {}).filter(k => k.includes('SUPABASE')))
    return NextResponse.json(
      {
        error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY not configured',
        url,
        isConfigured: false,
        debug: {
          hasProcessEnv: !!process.env,
          hasNextPublicSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          envKeys: Object.keys(process.env || {}).filter(k => k.includes('SUPABASE'))
        }
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    url,
    anonKey: anonKey,
    isConfigured: true
  })
}