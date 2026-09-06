import { NextResponse } from 'next/server'

// Get Supabase anon key - try different ways for Cloudflare Workers
function getSupabaseAnonKey(): string | undefined {
  // Try standard way
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }

  // Try without NEXT_PUBLIC prefix
  if (process.env.SUPABASE_ANON_KEY) {
    return process.env.SUPABASE_ANON_KEY
  }

  // Cloudflare Workers binding
  const env = (globalThis as any).env
  if (env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
  if (env?.SUPABASE_ANON_KEY) {
    return env.SUPABASE_ANON_KEY
  }

  return undefined
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
  const anonKey = getSupabaseAnonKey()

  if (!anonKey) {
    return NextResponse.json(
      {
        error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY not configured',
        url,
        isConfigured: false,
        debug: {
          availableVars: Object.keys(process.env || {}).filter(k => k.includes('SUPABASE'))
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