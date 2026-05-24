import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'

// Helper: Get authenticated user from request
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Auth error:', error.message)
      return null
    }
    
    if (!user) {
      return null
    }
    
    return { id: user.id, email: user.email || '' }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

// POST - Ensure user has a default trading account
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trading-accounts/ensure-default POST] Checking for default account...')

    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no auth user')
      return NextResponse.json({ error: 'Unauthorized - Please login' }, { status: 401 })
    }

    const userId = authUser.id

    // Check if user already has trading accounts
    const existingAccounts = await db.tradingAccount.findMany({
      where: { user_id: userId }
    })

    // If user has accounts, return the default one or the first one
    if (existingAccounts.length > 0) {
      const defaultAccount = existingAccounts.find(acc => acc.is_default) || existingAccounts[0]
      console.log('✅ [API] User already has accounts, returning:', defaultAccount.id)
      return NextResponse.json({ account: defaultAccount, exists: true })
    }

    // Create a default account
    console.log('💾 [API] Creating default account for user:', userId)
    const defaultAccount = await db.tradingAccount.create({
      data: {
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
      }
    })

    console.log('✅ [API] Default account created:', defaultAccount.id)
    return NextResponse.json({ account: defaultAccount, created: true })
  } catch (err) {
    console.error('❌ [API] Ensure default account error:', err)
    return NextResponse.json({ error: 'Failed to ensure default account', details: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
