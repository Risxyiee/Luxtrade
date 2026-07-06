import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { error, user } = await requireAuth(request)
    if (error) return error

    const body = await request.json()
    const { userId, email, fullName } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Only allow creating profile for the authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: cannot create profile for another user' },
        { status: 403 }
      )
    }

    // Check if profile already exists in Prisma/SQLite
    const existingProfile = await db.profile.findUnique({
      where: { id: userId }
    })

    if (existingProfile) {
      return NextResponse.json({ profile: existingProfile, created: false })
    }

    // Create new profile using Prisma
    const profile = await db.profile.create({
      data: {
        id: userId,
        email: email || user.email || null,
        full_name: fullName || null,
        plan: 'FREE',
        is_pro: false,
        role: 'USER',
        streakCount: 0,
        bestStreak: 0,
        achievements: '[]',
      }
    })

    return NextResponse.json({ profile, created: true })
  } catch (error: any) {
    console.error('❌ Ensure profile error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}