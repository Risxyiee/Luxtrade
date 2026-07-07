import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// Helper function to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    return profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// GET /api/admin/social-links - Get all social link submissions (admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const adminCheck = await isAdmin(authUser.id)
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build where clause
    const where: any = {}
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      where.status = status
    }

    // Fetch social links with user info
    const socialLinks = await db.socialLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            role: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: socialLinks,
      count: socialLinks.length
    })

  } catch (error) {
    console.error('Error fetching social links (admin):', error)
    return NextResponse.json(
      { error: 'Failed to fetch social links' },
      { status: 500 }
    )
  }
}
