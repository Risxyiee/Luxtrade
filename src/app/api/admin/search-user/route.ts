import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    // Validation
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Find user by email in users table (Prisma)
    const user = await db.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Also try to get profile data from auth.profiles
    let profileData: any = null
    try {
      const profiles = await db.$queryRaw`
        SELECT * FROM auth.profiles WHERE email = ${email} LIMIT 1
      `
      if (profiles && (profiles as any[]).length > 0) {
        profileData = (profiles as any[])[0]
      }
    } catch (error) {
      console.log('Profile fetch error:', error)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        proExpiry: user.proExpiry?.toISOString() || null,
        role: user.role,
        streakCount: user.streakCount,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        // Include profile data if available
        profile: profileData ? {
          is_pro: profileData.is_pro,
          subscription_status: profileData.subscription_status,
          subscription_until: profileData.subscription_until,
          device_id: profileData.device_id,
          full_name: profileData.full_name
        } : null
      }
    })

  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json(
      { error: 'Failed to search user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
