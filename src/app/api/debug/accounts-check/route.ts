import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createClientForApi(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const debugInfo = {
      userId: user.id,
      userEmail: user.email,
      checks: []
    }

    // Note: Not checking with regular client since we're using cookie-based auth now
    // Direct to admin client check

    // Check: Fetch with admin client (bypasses RLS)
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

      // Check 2: Direct SQL query to see all records
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
    } else {
      debugInfo.checks.push({
        name: 'Admin Client',
        success: false,
        error: 'supabaseAdmin is not configured'
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
