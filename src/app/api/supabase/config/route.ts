import { NextResponse } from 'next/server'

/**
 * API endpoint to retrieve Supabase configuration for client-side use.
 * This is safe because only the anon key (public) is exposed.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_ANON_KEY

  if (!anonKey) {
    return NextResponse.json(
      {
        error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY not configured',
        url,
        isConfigured: false
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