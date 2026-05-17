import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all users - Tanpa filter untuk debugging
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ADMIN API] Fetching ALL users from Prisma...')
    console.log('🔍 [ADMIN API] Database URL check:', process.env.DATABASE_URL ? '✓ SET' : '✗ NOT SET')

    // Test connection first
    console.log('📊 [ADMIN API] Testing database connection...')
    const userCount = await db.user.count()
    console.log(`✅ [ADMIN API] Database connection OK: ${userCount} users found`)

    if (userCount === 0) {
      console.warn('⚠️ [ADMIN API] No users found in database!')
      return NextResponse.json({ users: [], count: 0, message: 'No users in database' })
    }

    // Get ALL users with their subscriptions
    console.log('📊 [ADMIN API] Fetching users with subscriptions...')
    const users = await db.user.findMany({
      include: {
        subscriptions: {
          where: {
            status: 'active'
          },
          orderBy: { endDate: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`✅ [ADMIN API] Found ${users.length} users in database`)
    console.log('📊 [ADMIN API] Raw users data:', JSON.stringify(users.map(u => ({ id: u.id, email: u.email, role: u.role })), null, 2))

    // Format users to match admin panel expectations
    const formattedUsers = users.map(user => {
      const activeSubscription = user.subscriptions?.[0]
      const isPro = activeSubscription?.plan === 'PRO' || user.role === 'ADMIN'

      const formatted = {
        id: user.id,
        email: user.email,
        full_name: user.name || '',
        subscription_status: activeSubscription?.status || 'inactive',
        is_pro: isPro,
        subscription_until: activeSubscription?.endDate?.toISOString() || null,
        my_referral_code: null, // Not in current schema
        referred_by_code: null, // Not in current schema
        affiliate_balance: 0, // Not in current schema
        referral_status: null,
        has_ever_been_pro: isPro,
        commission_paid: false,
        created_at: user.createdAt.toISOString(),
        referred_by: null,
        referral_code_changes: 0,
        has_duplicate_device: false,
        device_id: null
      }

      console.log(`📊 [ADMIN API] Formatted user: ${user.email} - is_pro: ${formatted.is_pro}, subscription_status: ${formatted.subscription_status}`)

      return formatted
    })

    console.log(`✅ [ADMIN API] Returning ${formattedUsers.length} formatted users`)
    console.log('📊 [ADMIN API] Formatted users:', JSON.stringify(formattedUsers, null, 2))

    return NextResponse.json({ users: formattedUsers, count: formattedUsers.length })
  } catch (error) {
    console.error('❌ [ADMIN API] ERROR fetching users:', error)
    console.error('❌ [ADMIN API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      code: (error as any)?.code,
      meta: (error as any)?.meta,
    }

    console.error('❌ [ADMIN API] Error details:', JSON.stringify(errorDetails, null, 2))

    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        details: errorDetails.message,
        debug: errorDetails
      },
      { status: 500 }
    )
  }
}

// POST create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    const user = await db.user.create({
      data: {
        email,
        name: name || null
      }
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('❌ Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
