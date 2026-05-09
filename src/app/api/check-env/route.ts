import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ SET' : '✗ NOT SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ SET' : '✗ NOT SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ SET' : '✗ NOT SET',
    DATABASE_URL: process.env.DATABASE_URL ? '✓ SET' : '✗ NOT SET',
  }

  const supabaseAdminStatus = supabaseAdmin ? '✓ INITIALIZED' : '✗ NOT INITIALIZED'

  return NextResponse.json({
    environment: envStatus,
    supabaseAdmin: supabaseAdminStatus,
    message: supabaseAdmin ? 'All environment variables are configured' : 'SUPABASE_SERVICE_ROLE_KEY is missing',
    instructions: !supabaseAdmin ? {
      error: 'SUPABASE_SERVICE_ROLE_KEY not configured',
      solution: [
        '1. Go to Supabase Dashboard → Project Settings → API',
        '2. Copy the service_role key',
        '3. Add to .env.local file: SUPABASE_SERVICE_ROLE_KEY=<your-key>',
        '4. Restart the dev server'
      ]
    } : null
  })
}
