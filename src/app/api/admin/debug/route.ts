import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAdminStatus } from '@/lib/supabase-admin-alt'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const adminStatus = getAdminStatus()

    const debugInfo: Record<string, any> = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
        altServiceRoleKey: process.env.SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
        supabaseAdminAvailable: !!supabaseAdmin,
        ...adminStatus
      },
      test: {
        message: 'Debug endpoint working'
      } as Record<string, any>
    }

    // Test supabaseAdmin if available
    if (supabaseAdmin) {
      try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
        debugInfo.test.listUsers = error ? 'FAILED: ' + error.message : 'SUCCESS'
        debugInfo.test.userCount = users?.length || 0
      } catch (err: any) {
        debugInfo.test.listUsers = 'EXCEPTION: ' + err.message
      }
    } else {
      debugInfo.test.listUsers = 'SKIPPED: supabaseAdmin is null'
    }

    return NextResponse.json(debugInfo)
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
