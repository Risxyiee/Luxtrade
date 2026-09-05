import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthenticatedUser } from '@/lib/api-auth'

// POST - Ensure user has a default trading account
export async function POST(request: NextRequest) {
  try {
    console.log('[API /api/trading-accounts/ensure-default POST] Checking for default account...')

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user

    if (!authUser) {
      console.log('[API] Unauthorized - no auth user')
      return NextResponse.json({ error: 'Unauthorized - Please login' }, { status: 401 })
    }

    const userId = authUser.id

    // Check if user already has trading accounts
    const { data: existingAccounts } = await admin.from('trading_accounts').select('*').eq('user_id', userId)

    // If user has accounts, return the default one or the first one
    if (existingAccounts && existingAccounts.length > 0) {
      const defaultAccount = existingAccounts.find((acc: any) => acc.is_default) || existingAccounts[0]
      console.log('[API] User already has accounts, returning:', defaultAccount.id)
      return NextResponse.json({ account: defaultAccount, exists: true })
    }

    // Create a default account
    console.log('[API] Creating default account for user:', userId)
    const { data: defaultAccount, error: createError } = await admin.from('trading_accounts').insert({
      user_id: userId,
      name: 'Default Account',
      broker: 'Unknown',
      account_type: 'STANDARD',
      account_number: null,
      initial_balance: 0,
      current_balance: 0,
      leverage: 100,
      currency: 'USD',
      is_default: true,
      is_active: true,
    }).select().single()

    if (createError) {
      console.error('[API] Failed to create default account:', createError)
      return NextResponse.json({ error: 'Failed to ensure default account', details: createError.message }, { status: 500 })
    }

    console.log('[API] Default account created:', defaultAccount.id)
    return NextResponse.json({ account: defaultAccount, created: true })
  } catch (err) {
    console.error('[API] Ensure default account error:', err)
    return NextResponse.json({ error: 'Failed to ensure default account', details: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}