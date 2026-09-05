import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthenticatedUser } from '@/lib/api-auth'

// Helper function to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return false

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

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
    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user

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

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
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

    // Check if social link exists (with user info)
    const { data: socialLink, error: fetchError } = await admin
      .from('social_links')
      .select(`
        *,
        user:profiles (
          id,
          email,
          full_name
        )
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !socialLink) {
      return NextResponse.json(
        { error: 'Social link not found' },
        { status: 404 }
      )
    }

    // Update social link status
    const updateData: Record<string, any> = {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewed_by: authUser.email,
      reviewed_at: new Date().toISOString(),
    }

    if (action === 'reject' && rejectionReason) {
      updateData.rejection_reason = rejectionReason
    }

    const { data: updatedLink, error: updateError } = await admin
      .from('social_links')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating social link (admin):', updateError)
      return NextResponse.json(
        { error: 'Failed to update social link' },
        { status: 500 }
      )
    }

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
    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user

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

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    // Check if social link exists
    const { data: socialLink, error: fetchError } = await admin
      .from('social_links')
      .select('id')
      .eq('id', params.id)
      .single()

    if (fetchError || !socialLink) {
      return NextResponse.json(
        { error: 'Social link not found' },
        { status: 404 }
      )
    }

    // Delete social link
    const { error: deleteError } = await admin
      .from('social_links')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Error deleting social link (admin):', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete social link' },
        { status: 500 }
      )
    }

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
