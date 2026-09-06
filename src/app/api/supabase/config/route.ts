import { NextResponse } from 'next/server'

// TEMPORARY: Fallback anon key for production
const FALLBACK_ANON_KEY = 'REDACTED-DEAD-KEY'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'

  // Try to get anon key from env, fallback to hardcoded
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                   process.env.SUPABASE_ANON_KEY ||
                   FALLBACK_ANON_KEY

  return NextResponse.json({
    url,
    anonKey: anonKey,
    isConfigured: true
  })
}