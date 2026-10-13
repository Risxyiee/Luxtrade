import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to check if env vars are accessible in server-side API routes
 */
export async function GET(request: NextRequest) {
  const envInfo = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET ✓' : 'MISSING ✗',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `SET (length: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length})` : 'MISSING ✗',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? `SET (length: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length})` : 'MISSING ✗',
    // Show all env keys
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')),
    // Try to read using different methods
    directRead: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_preview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
    },
  }

  console.log('[test-env] Server-side env check:', JSON.stringify(envInfo, null, 2))

  return NextResponse.json(envInfo)
}