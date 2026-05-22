import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

// Helper: Get authenticated user from request
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        return { id: user.id, email: user.email || '' }
      }
    }
    return null
  } catch {
    return null
  }
}

// Helper: Ensure profile exists (auto-create if not)
async function ensureProfile(userId: string, email?: string): Promise<void> {
  try {
    const existing = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!existing) {
      console.log('📝 Auto-creating profile for user:', userId)
      await db.profile.create({
        data: {
          id: userId,
          email: email || null,
          plan: 'FREE',
          is_pro: false,
          role: 'USER',
          streakCount: 0,
          bestStreak: 0,
          achievements: '[]',
        }
      })
      console.log('✅ Profile created automatically')
    }
  } catch (error) {
    console.error('❌ Error creating profile:', error)
    throw error
  }
}

// GET - Fetch all trading accounts for authenticated user
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized - Please login' }, { status: 401 })
    }

    const accounts = await db.tradingAccount.findMany({
      where: {
        user_id: authUser.id,
        is_active: true
      },
      orderBy: [
        { is_default: 'desc' },
        { created_at: 'desc' }
      ]
    })

    return NextResponse.json({ accounts })
  } catch (err) {
    console.error('Trading accounts API error:', err)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

// POST - Create new trading account
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trading-accounts POST] Creating trading account...')

    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no auth user')
      return NextResponse.json({ error: 'Unauthorized - Please login' }, { status: 401 })
    }

    const userId = authUser.id
    const body = await request.json()
    console.log('📊 [API] Request body:', body)

    // Auto-create profile if not exists
    await ensureProfile(userId, authUser.email)

    // Check if this is the first account (make it default)
    const existingAccounts = await db.tradingAccount.count({
      where: { user_id: userId }
    })

    const isDefault = existingAccounts === 0 || body.is_default === true

    // If setting this as default, unset other defaults
    if (isDefault) {
      await db.tradingAccount.updateMany({
        where: { user_id: userId },
        data: { is_default: false }
      })
    }

    console.log('💾 [API] Creating trading account in database...')
    const account = await db.tradingAccount.create({
      data: {
        user_id: userId,
        name: body.name || 'Account',
        broker: body.broker || null,
        account_type: body.account_type || 'STANDARD',
        account_number: body.account_number || null,
        initial_balance: body.initial_balance || 0,
        current_balance: body.current_balance || body.initial_balance || 0,
        leverage: body.leverage || 100,
        currency: body.currency || 'USD',
        is_default: isDefault,
        is_active: true,
      }
    })

    console.log('✅ [API] Trading account created successfully:', account.id)
    return NextResponse.json({ account })
  } catch (err) {
    console.error('❌ [API] Trading account create error:', err)
    return NextResponse.json({ error: 'Failed to create account', details: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
