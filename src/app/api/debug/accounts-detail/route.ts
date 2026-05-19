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

    console.log('🔍 [DEBUG ACCOUNTS] User ID:', user.id)

    // Get all accounts using admin client
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { data: accounts, error: fetchError } = await supabaseAdmin
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('🔴 [DEBUG ACCOUNTS] Error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    console.log('📊 [DEBUG ACCOUNTS] Found accounts:', accounts?.length || 0)

    // Analyze each account
    const analysis = (accounts || []).map(account => {
      const hasMetaApiId = !!account.metaapi_account_id
      const isPending = account.status === 'PENDING'
      const isConnected = account.status === 'CONNECTED'

      return {
        id: account.id,
        account_number: account.account_number,
        broker_server: account.broker_server,
        platform: account.platform,
        status: account.status,
        metaapi_account_id: account.metaapi_account_id || null,
        has_metaapi_id: hasMetaApiId,
        created_at: account.created_at,
        issues: [
          hasMetaApiId && isPending ? 'Has metaapi_account_id but status is PENDING (should be CONNECTED)' : null,
          !hasMetaApiId && isConnected ? 'Missing metaapi_account_id but status is CONNECTED (should be PENDING)' : null,
          !hasMetaApiId && isPending ? 'No metaapi_account_id - account not connected to MetaApi yet' : null
        ].filter(Boolean),
        needs_fix: (hasMetaApiId && isPending) || (!hasMetaApiId && isConnected)
      }
    })

    return NextResponse.json({
      success: true,
      user_id: user.id,
      total_accounts: accounts?.length || 0,
      accounts: analysis,
      summary: {
        needs_fix: analysis.filter(a => a.needs_fix).length,
        pending: analysis.filter(a => a.status === 'PENDING').length,
        connected: analysis.filter(a => a.status === 'CONNECTED').length,
        with_metaapi_id: analysis.filter(a => a.has_metaapi_id).length
      }
    })

  } catch (error: any) {
    console.error('🔴 [DEBUG ACCOUNTS] Error:', error)
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
