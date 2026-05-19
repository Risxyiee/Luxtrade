import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
    },
    clients: {
      supabase: supabase ? '✅ Available' : '❌ Not available',
      supabaseAdmin: supabaseAdmin ? '✅ Available' : '❌ Not available',
    },
    tests: [] as any[],
  }

  // Test 1: Try to get current session (no auth required)
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getSession()
      results.tests.push({
        name: 'Get Session',
        success: !error,
        error: error?.message || null,
        hasSession: !!data.session,
      })
    } catch (e: any) {
      results.tests.push({
        name: 'Get Session',
        success: false,
        error: e.message,
      })
    }
  }

  // Test 2: Try to check connection with admin client
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('count', { count: 'exact', head: true })
      results.tests.push({
        name: 'Admin DB Query (profiles count)',
        success: !error,
        error: error?.message || null,
        count: data?.count || 0,
      })
    } catch (e: any) {
      results.tests.push({
        name: 'Admin DB Query',
        success: false,
        error: e.message,
      })
    }
  }

  return NextResponse.json(results)
}
