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

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const debugInfo = {
      userId: user.id,
      userEmail: user.email,
      checks: []
    }

    // Check 1: Fetch with regular client (subject to RLS)
    console.log('🔍 [DEBUG] Checking with regular supabase client...')
    const { data: regularData, error: regularError } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)

    debugInfo.checks.push({
      name: 'Regular Client (with RLS)',
      success: !regularError,
      count: regularData?.length || 0,
      error: regularError?.message || null,
      data: regularData
    })

    // Check 2: Fetch with admin client (bypasses RLS)
    console.log('🔍 [DEBUG] Checking with supabaseAdmin...')
    if (supabaseAdmin) {
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id)

      debugInfo.checks.push({
        name: 'Admin Client (no RLS)',
        success: !adminError,
        count: adminData?.length || 0,
        error: adminError?.message || null,
        data: adminData
      })
    } else {
      debugInfo.checks.push({
        name: 'Admin Client',
        success: false,
        error: 'supabaseAdmin is not configured'
      })
    }

    // Check 3: Direct SQL query to see all records
    if (supabaseAdmin) {
      const { data: allData, error: allError } = await supabaseAdmin
        .from('trading_accounts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      debugInfo.checks.push({
        name: 'All Accounts (Admin, last 10)',
        success: !allError,
        count: allData?.length || 0,
        error: allError?.message || null,
        data: allData?.map(acc => ({
          id: acc.id,
          user_id: acc.user_id,
          account_number: acc.account_number,
          status: acc.status,
          platform: acc.platform,
          created_at: acc.created_at
        }))
      })
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo
    })
  } catch (error: any) {
    console.error('🔴 [DEBUG] Error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
