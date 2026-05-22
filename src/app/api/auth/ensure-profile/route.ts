import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, fullName } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    console.log('🔄 Ensuring profile exists for user:', userId)

    // Check if profile already exists in Prisma/SQLite
    const existingProfile = await db.profile.findUnique({
      where: { id: userId }
    })

    if (existingProfile) {
      console.log('✅ Profile already exists')
      return NextResponse.json({ profile: existingProfile, created: false })
    }

    // Create new profile using Prisma
    console.log('📝 Creating new profile in SQLite...')
    const profile = await db.profile.create({
      data: {
        id: userId,
        email: email || null,
        full_name: fullName || null,
        plan: 'FREE',
        is_pro: false,
        role: 'USER',
        streakCount: 0,
        bestStreak: 0,
        achievements: '[]',
      }
    })

    console.log('✅ Profile created successfully')
    return NextResponse.json({ profile, created: true })
  } catch (error: any) {
    console.error('❌ Ensure profile error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
