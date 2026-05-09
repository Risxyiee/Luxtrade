import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all users - WITHOUT ANY FILTER
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching ALL users from Prisma (no filters)...')

    // Get ALL users without any filters
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' }
    })

    console.log(`✅ Found ${users.length} users in database`)

    // Get subscription count for each user
    const usersWithSubCount = await Promise.all(
      users.map(async (user) => {
        const subscriptionCount = await db.userSubscription.count({
          where: { userId: user.id }
        })

        return {
          ...user,
          subscriptionCount
        }
      })
    )

    console.log(`✅ Returning ${usersWithSubCount.length} users with subscription counts`)
    return NextResponse.json({ users: usersWithSubCount })
  } catch (error) {
    console.error('❌ Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
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
