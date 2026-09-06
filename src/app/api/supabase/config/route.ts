import { NextResponse } from 'next/server'

const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAwNTQwMjksImV4cCI6MjA0NTYzMDAyOX0.DkCkO4z3D9Yk_2VZQ_M4pC0eJ8xwJ-5D8x_7kK9F4w8'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'

  // Use SUPABASE_ANON_KEY directly
  let anonKey = process.env.SUPABASE_ANON_KEY

  if (!anonKey) {
    console.warn('[Supabase Config] SUPABASE_ANON_KEY not found, using fallback')
    anonKey = FALLBACK_ANON_KEY
  } else {
    console.log('[Supabase Config] Using SUPABASE_ANON_KEY (length:', anonKey.length, ')')
  }

  return NextResponse.json({
    url,
    anonKey: anonKey,
    isConfigured: !!anonKey,
    source: process.env.SUPABASE_ANON_KEY ? 'SUPABASE_ANON_KEY' : 'fallback',
    debug: {
      hasNEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
    }
  })
}
