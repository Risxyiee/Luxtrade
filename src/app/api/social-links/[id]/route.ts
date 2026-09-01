import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthUser } from '@/lib/api-auth'

// DELETE /api/social-links/[id] - Delete a social link (user's own only)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('[API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if social link exists and belongs to user
    const { data: socialLink } = await admin.from('social_links')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (!socialLink) {
      return NextResponse.json(
        { error: 'Social link not found' },
        { status: 404 }
      )
    }

    if (socialLink.user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Forbidden. You can only delete your own links.' },
        { status: 403 }
      )
    }

    // Delete social link
    await admin.from('social_links').delete().eq('id', params.id)

    return NextResponse.json({
      success: true,
      message: 'Social link deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting social link:', error)
    return NextResponse.json(
      { error: 'Failed to delete social link' },
      { status: 500 }
    )
  }
}
