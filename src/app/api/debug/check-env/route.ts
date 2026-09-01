import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey, getServerClient, getSupabaseAdmin, getBaseUrl } from '@/lib/supabase'
import { isDatabaseAvailable, getDatabaseUnavailableReason } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const url = getSupabaseUrl()
    const anon = getSupabaseAnonKey()
    const svcKey = getSupabaseServiceRoleKey()

    // Masked values for safety
    const mask = (v?: string) => (v ? (v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : '***') : null)

    const serverClient = getServerClient()
    const adminClient = getSupabaseAdmin()

    // DB status
    const dbAvailable = isDatabaseAvailable()
    const dbReason = getDatabaseUnavailableReason()

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      siteBaseUrl: getBaseUrl(),
      env: {
        NEXT_PUBLIC_SUPABASE_URL: url ? mask(url) : null,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anon ? mask(anon) : null,
        SUPABASE_SERVICE_ROLE_KEY: svcKey ? mask(svcKey) : null,
        DATABASE_URL: process.env.DATABASE_URL ? (process.env.DATABASE_URL.length > 16 ? `${process.env.DATABASE_URL.slice(0, 8)}...` : process.env.DATABASE_URL) : null,
      },
      clients: {
        serverClientAvailable: !!serverClient,
        adminClientAvailable: !!adminClient,
      },
      database: {
        available: !!dbAvailable,
        reason: dbAvailable ? null : dbReason,
      }
    })
  } catch (error: any) {
    console.error('[debug/check-env] Error:', error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
