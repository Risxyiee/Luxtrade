import { NextResponse } from 'next/server'

const FALLBACK_ANON_KEY = 'REDACTED-DEAD-KEY'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY

  return NextResponse.json({
    url,
    anonKey: anonKey,
    isConfigured: true
  })
}
