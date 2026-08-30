import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

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
