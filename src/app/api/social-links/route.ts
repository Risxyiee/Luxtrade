import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'

// Helper: Get authenticated user from request
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('❌ [API] Supabase auth error:', error.message)
      return null
    }

    if (!user) {
      console.log('❌ [API] No user found in session')
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

// POST /api/social-links - Submit a new social link for approval
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = authUser.id

    // Auto-create profile if not exists
    await ensureProfile(userId, authUser.email)
    console.log('✅ [API] Profile ensured for user:', userId)

    const body = await request.json()
    const { platform, url, username } = body

    // Validate required fields
    if (!platform || !url) {
      return NextResponse.json(
        { error: 'Platform and URL are required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Check if user already has a PENDING or APPROVED link for this platform
    const existingLink = await db.socialLink.findFirst({
      where: {
        userId: userId,
        platform: platform.toLowerCase(),
        status: { in: ['PENDING', 'APPROVED'] }
      }
    })

    if (existingLink) {
      if (existingLink.status === 'PENDING') {
        return NextResponse.json(
          { error: 'You already have a pending link for this platform. Wait for approval.' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'You already have an approved link for this platform.' },
          { status: 400 }
        )
      }
    }

    // Create social link with PENDING status
    const socialLink = await db.socialLink.create({
      data: {
        userId: userId,
        platform: platform.toLowerCase(),
        url,
        username: username || null,
        status: 'PENDING'
      }
    })

    return NextResponse.json({
      success: true,
      data: socialLink,
      message: 'Social link submitted for approval'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating social link:', error)
    return NextResponse.json(
      { error: 'Failed to submit social link' },
      { status: 500 }
    )
  }
}

// GET /api/social-links - Get user's social links
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const socialLinks = await db.socialLink.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: socialLinks
    })

  } catch (error) {
    console.error('Error fetching social links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch social links' },
      { status: 500 }
    )
  }
}
