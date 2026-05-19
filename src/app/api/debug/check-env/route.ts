import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const authHeader = req.headers.get('authorization')
    let user = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data.user) {
        user = data.user
      }
    }

    if (!user) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        user = session.user
      }
    }

    const envInfo = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configured' : '❌ Missing',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `✅ Configured (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} chars)` : '❌ Missing',
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? `✅ Configured (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)` : '❌ Missing',
      metaApiToken: process.env.METAAPI_TOKEN ? `✅ Configured (${process.env.METAAPI_TOKEN.length} chars)` : '❌ Missing',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'Not set',
    }

    const clientInfo = {
      supabaseClient: supabase ? '✅ Available' : '❌ Not available',
      supabaseAdminClient: supabaseAdmin ? '✅ Available' : '❌ Not available',
    }

    // Try to fetch user's accounts
    let accountsInfo = null
    if (user && supabaseAdmin) {
      const { data: accounts, error: accountsError } = await supabaseAdmin
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id)

      accountsInfo = {
        success: !accountsError,
        count: accounts?.length || 0,
        error: accountsError?.message || null,
        accounts: accounts?.map(a => ({
          id: a.id,
          account_number: a.account_number,
          status: a.status,
          metaapi_account_id: a.metaapi_account_id || null,
          has_metaapi_id: !!a.metaapi_account_id,
          created_at: a.created_at,
        })) || [],
      }
    }

    return NextResponse.json({
      success: true,
      user: user ? {
        id: user.id,
        email: user.email,
      } : null,
      environment: envInfo,
      clients: clientInfo,
      accounts: accountsInfo,
    })
  } catch (error: any) {
    console.error('🔴 [DEBUG ENV] Error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
