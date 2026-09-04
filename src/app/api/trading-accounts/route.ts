import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

// GET - Fetch all trading accounts for authenticated user
export async function GET(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trading-accounts GET] Fetching accounts...')

    const { user, client, error } = await getAuthenticatedUser(request)

    if (!user || !client) {
      console.log('❌ [API] Unauthorized - no valid user or client')
      return NextResponse.json(
        { error: error || 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const { data: accounts, error: supabaseError } = await client
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (supabaseError) {
      console.error('❌ [API /api/trading-accounts GET] Supabase error:', supabaseError)
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      )
    }

    console.log(`✅ [API] Found ${accounts?.length ?? 0} accounts for user ${user.id}`)
    return NextResponse.json({ accounts: accounts ?? [] })
  } catch (err) {
    console.error('❌ [API /api/trading-accounts GET] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

// POST - Create new trading account
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trading-accounts POST] Creating trading account...')

    const { user, client, error } = await getAuthenticatedUser(request)

    if (!user || !client) {
      console.log('❌ [API] Unauthorized - no valid user or client')
      return NextResponse.json(
        { error: error || 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const userId = user.id
    const body = await request.json()
    console.log('📊 [API] Request body:', body)

    // Validate required fields
    if (!body.name) {
      console.log('❌ [API] Missing required field: name')
      return NextResponse.json(
        { error: 'Account name is required' },
        { status: 400 }
      )
    }

    // Check if this is the first account (make it default)
    const { count: existingAccounts } = await client
      .from('trading_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const isDefault = (existingAccounts ?? 0) === 0 || body.is_default === true

    // If setting this as default, unset other defaults
    if (isDefault) {
      console.log('🔄 [API] Setting account as default, unsetting others...')
      await client
        .from('trading_accounts')
        .update({ is_default: false })
        .eq('user_id', userId)
    }

    const currentBalance = body.current_balance
      ? parseFloat(String(body.current_balance))
      : (body.initial_balance ? parseFloat(String(body.initial_balance)) : 0)

    console.log('💾 [API] Creating trading account in database...')
    const { data: account, error: insertError } = await client
      .from('trading_accounts')
      .insert([{
        user_id: userId,
        name: String(body.name),
        broker: body.broker ? String(body.broker) : null,
        account_type: body.account_type ? String(body.account_type) : 'STANDARD',
        account_number: body.account_number ? String(body.account_number) : null,
        initial_balance: body.initial_balance ? parseFloat(String(body.initial_balance)) : 0,
        current_balance: currentBalance,
        leverage: body.leverage ? parseInt(String(body.leverage)) : 100,
        broker_gmt_offset: body.broker_gmt_offset != null && body.broker_gmt_offset !== ''
          ? parseInt(String(body.broker_gmt_offset))
          : 0,
        currency: body.currency ? String(body.currency) : 'USD',
        is_default: Boolean(isDefault),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (insertError) {
      console.error('❌ [API /api/trading-accounts POST] Supabase error:', insertError)

      if (insertError.code === '23503') {
        console.error('❌ [API] Foreign key constraint violation - profile may not exist')
        return NextResponse.json(
          { error: 'User profile not found. Please try logging out and in again.' },
          { status: 400 }
        )
      }

      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Account number already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      )
    }

    console.log('✅ [API] Trading account created successfully:', account.id)
    return NextResponse.json({ account })
  } catch (err) {
    console.error('❌ [API /api/trading-accounts POST] Error:', err)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')

    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}