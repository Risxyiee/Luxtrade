import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// GET /api/admin/testimonials — List ALL testimonials (including pending/rejected)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ error: 'Admin client not available' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'pending', 'approved', 'rejected', or null for all
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = svc
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: testimonials, error } = await query

    if (error) {
      console.error('[admin-testimonials] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch testimonials' }, { status: 500 })
    }

    // Also get counts by status
    const { data: allTestimonials } = await svc
      .from('testimonials')
      .select('status')

    const counts = {
      total: allTestimonials?.length || 0,
      pending: allTestimonials?.filter(t => t.status === 'pending').length || 0,
      approved: allTestimonials?.filter(t => t.status === 'approved').length || 0,
      rejected: allTestimonials?.filter(t => t.status === 'rejected').length || 0,
    }

    return NextResponse.json({
      success: true,
      testimonials: testimonials || [],
      counts,
    })
  } catch (error) {
    console.error('[admin-testimonials] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/testimonials — Update testimonial status (approve/reject/feature)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ error: 'Admin client not available' }, { status: 500 })
    }

    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
    }

    let updateData: Record<string, any> = {}

    switch (action) {
      case 'approve':
        updateData = { status: 'approved' }
        break
      case 'reject':
        updateData = { status: 'rejected' }
        break
      case 'feature':
        updateData = { is_featured: true }
        break
      case 'unfeature':
        updateData = { is_featured: false }
        break
      case 'verify':
        updateData = { is_verified: true }
        break
      case 'unverify':
        updateData = { is_verified: false }
        break
      default:
        return NextResponse.json({ error: 'Invalid action. Use: approve, reject, feature, unfeature, verify, unverify' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await svc
      .from('testimonials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[admin-testimonials] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      testimonial: updated,
    })
  } catch (error) {
    console.error('[admin-testimonials] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/testimonials — Delete a testimonial (admin override)
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ error: 'Admin client not available' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Testimonial ID is required' }, { status: 400 })
    }

    const { error: deleteError } = await svc
      .from('testimonials')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[admin-testimonials] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Testimonial deleted',
    })
  } catch (error) {
    console.error('[admin-testimonials] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
