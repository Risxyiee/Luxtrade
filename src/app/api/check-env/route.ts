import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: {
      set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      value: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...' || 'NOT SET'
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...' || 'NOT SET'
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      value: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...' || 'NOT SET - ⚠️ ADMIN PANEL TIDAK AKAN BEKERJA!'
    },
    DATABASE_URL: {
      set: !!process.env.DATABASE_URL,
      value: process.env.DATABASE_URL?.substring(0, 20) + '...' || 'NOT SET'
    }
  }

  const allSet = Object.values(envStatus).every(e => e.set)

  return NextResponse.json({
    status: allSet ? 'ALL_ENV_SET' : 'MISSING_ENV_VARS',
    environment: envStatus,
    recommendations: {
      ifMissingServiceRoleKey: 'Add SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard → Settings → API → service_role (secret)',
      ifMissingSupabaseUrl: 'Add NEXT_PUBLIC_SUPABASE_URL from Supabase Dashboard → Settings → API → Project URL',
      ifMissingAnonKey: 'Add NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase Dashboard → Settings → API → anon public key'
    }
  })
}
