import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthUser } from '@/lib/api-auth'

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

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build query
    let query = admin
      .from('social_links')
      .select(`
        *,
        user:profiles (
          id,
          email,
          full_name,
          role
        )
      `)
      .order('created_at', { ascending: false })

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: socialLinks, error: dbError } = await query

    if (dbError) {
      console.error('Error fetching social links (admin):', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch social links' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: socialLinks || [],
      count: (socialLinks || []).length
    })

  } catch (error) {
    console.error('Error fetching social links (admin):', error)
    return NextResponse.json(
      { error: 'Failed to fetch social links' },
      { status: 500 }
    )
  }
}
