import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// TEMPORARY: API endpoint without authentication for testing
// TODO: Remove this in production and use proper Supabase auth
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trading-accounts/test-create] Creating trading account (NO AUTH)...')

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

    if (!body.user_id) {
      console.log('❌ [API] Missing required field: user_id')
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    // Ensure profile exists
    const existingProfile = await db.profile.findUnique({
      where: { id: body.user_id }
    })

    if (!existingProfile) {
      console.log('📝 [API] Creating profile for user:', body.user_id)
      await db.profile.create({
        data: {
          id: body.user_id,
          email: body.email || 'test@example.com',
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

    // Check if this is the first account (make it default)
    const existingAccounts = await db.tradingAccount.count({
      where: { user_id: body.user_id }
    })

    const isDefault = existingAccounts === 0 || body.is_default === true

    // If setting this as default, unset other defaults
    if (isDefault) {
      console.log('🔄 [API] Setting account as default, unsetting others...')
      await db.tradingAccount.updateMany({
        where: { user_id: body.user_id },
        data: { is_default: false }
      })
    }

    console.log('💾 [API] Creating trading account in database...')
    const account = await db.tradingAccount.create({
      data: {
        user_id: body.user_id,
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
    console.error('❌ [API /api/trading-accounts/test-create] Error:', err)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')

    return NextResponse.json(
      { error: 'Failed to create account', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}