import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all users - WITHOUT ANY FILTER
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching ALL users from Prisma (no filters)...')
    console.log('Database URL check:', process.env.DATABASE_URL ? '✓ SET' : '✗ NOT SET')

    // Test connection first
    console.log('📊 Testing database connection...')
    const userCount = await db.user.count()
    console.log(`✅ Database connection OK: ${userCount} users`)

    // Get ALL users with their subscriptions
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

    console.log(`✅ Found ${users.length} users in database`)

    // Format users to match admin panel expectations
    const formattedUsers = users.map(user => {
      const activeSubscription = user.subscriptions[0]
      const isPro = activeSubscription?.plan === 'PRO' || user.role === 'ADMIN'

      return {
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
    })

    console.log(`✅ Returning ${formattedUsers.length} formatted users`)
    return NextResponse.json({ users: formattedUsers, count: formattedUsers.length })
  } catch (error) {
    console.error('❌ Error fetching users:', error)

    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      code: (error as any)?.code,
      meta: (error as any)?.meta,
    }

    console.error('Error details:', JSON.stringify(errorDetails, null, 2))

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
