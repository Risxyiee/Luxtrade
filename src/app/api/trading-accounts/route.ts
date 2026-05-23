import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

// Helper: Get authenticated user from request
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.log('❌ [API] No authorization header')
      return null
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token || token === 'undefined') {
      console.log('❌ [API] Invalid or empty token')
      return null
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error) {
      console.error('❌ [API] Supabase auth error:', error.message)
      return null
    }

    if (!user) {
      console.log('❌ [API] No user found in token')
      return null
    }

    console.log('✅ [API] Authenticated user:', { id: user.id, email: user.email })
    return { id: user.id, email: user.email || '' }
  } catch (error) {
    console.error('❌ [API] Auth error:', error)
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
      console.log('📝 [API] Auto-creating profile for user:', userId)
      await db.profile.create({
        data: {
          id: userId,
          email: email || null,
          plan: 'FREE',
          is_pro: false,
          role: 'USER',
          streakCount: 0,
          bestStreak: 0,
          achievements: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
      console.log('✅ [API] Profile created successfully')
    }
  } catch (error) {
    console.error('❌ [API] Error creating profile:', error)
    throw error
  }
}

// GET - Fetch all trading accounts for authenticated user
export async function GET(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trading-accounts GET] Fetching accounts...')

    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
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

    console.log(`✅ [API] Found ${accounts.length} accounts for user ${authUser.id}`)
    return NextResponse.json({ accounts })
  } catch (err) {
    console.error('❌ [API /api/trading-accounts GET] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new trading account
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trading-accounts POST] Creating trading account...')

    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const userId = authUser.id
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

    // Auto-create profile if not exists
    await ensureProfile(userId, authUser.email)

    // Check if this is the first account (make it default)
    const existingAccounts = await db.tradingAccount.count({
      where: { user_id: userId }
    })

    const isDefault = existingAccounts === 0 || body.is_default === true

    // If setting this as default, unset other defaults
    if (isDefault) {
      console.log('🔄 [API] Setting account as default, unsetting others...')
      await db.tradingAccount.updateMany({
        where: { user_id: userId },
        data: { is_default: false }
      })
    }

    console.log('💾 [API] Creating trading account in database...')
    const account = await db.tradingAccount.create({
      data: {
        user_id: userId,
        name: String(body.name),
        broker: body.broker ? String(body.broker) : null,
        account_type: body.account_type ? String(body.account_type) : 'STANDARD',
        account_number: body.account_number ? String(body.account_number) : null,
        initial_balance: body.initial_balance ? parseFloat(String(body.initial_balance)) : 0,
        current_balance: body.current_balance
          ? parseFloat(String(body.current_balance))
          : (body.initial_balance ? parseFloat(String(body.initial_balance)) : 0),
        leverage: body.leverage ? parseInt(String(body.leverage)) : 100,
        currency: body.currency ? String(body.currency) : 'USD',
        is_default: Boolean(isDefault),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }
    })

    console.log('✅ [API] Trading account created successfully:', account.id)
    return NextResponse.json({ account })
  } catch (err) {
    console.error('❌ [API /api/trading-accounts POST] Error:', err)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')

    // Check for specific Prisma errors
    if (err instanceof Error) {
      if (err.message.includes('Foreign key constraint')) {
        console.error('❌ [API] Foreign key constraint violation - profile may not exist')
        return NextResponse.json(
          { error: 'User profile not found. Please try logging out and in again.', details: err.message },
          { status: 400 }
        )
      }

      if (err.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Account number already exists', details: err.message },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to create account', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
