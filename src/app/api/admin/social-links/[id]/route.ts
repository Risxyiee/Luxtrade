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

// PATCH /api/admin/social-links/[id] - Approve or reject a social link (admin only)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
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

    const body = await request.json()
    const { action, rejectionReason } = body

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Check if social link exists
    const socialLink = await db.socialLink.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        }
      }
    })

    if (!socialLink) {
      return NextResponse.json(
        { error: 'Social link not found' },
        { status: 404 }
      )
    }

    // Update social link status
    const updateData: any = {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewedBy: authUser.email,
      reviewedAt: new Date()
    }

    if (action === 'reject' && rejectionReason) {
      updateData.rejectionReason = rejectionReason
    }

    const updatedLink = await db.socialLink.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: updatedLink,
      message: action === 'approve'
        ? 'Social link approved successfully'
        : 'Social link rejected successfully'
    })

  } catch (error) {
    console.error('Error updating social link (admin):', error)
    return NextResponse.json(
      { error: 'Failed to update social link' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/social-links/[id] - Delete a social link (admin only)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
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

    // Check if social link exists
    const socialLink = await db.socialLink.findUnique({
      where: { id: params.id }
    })

    if (!socialLink) {
      return NextResponse.json(
        { error: 'Social link not found' },
        { status: 404 }
      )
    }

    // Delete social link
    await db.socialLink.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Social link deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting social link (admin):', error)
    return NextResponse.json(
      { error: 'Failed to delete social link' },
      { status: 500 }
    )
  }
}
