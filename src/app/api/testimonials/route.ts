import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch all approved testimonials
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const featured = searchParams.get('featured') === 'true'

    const supabase = await createClient()

    let query = supabase
      .from('testimonials')
      .select('*')
      .eq('status', 'approved')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })

    if (featured) {
      query = query.eq('is_featured', true)
    }

    query = query.limit(limit)

    const { data: testimonials, error } = await query

    if (error) {
      console.error('Error fetching testimonials:', error)
      return NextResponse.json(
        { error: 'Failed to fetch testimonials' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      testimonials: testimonials || []
    })
  } catch (error) {
    console.error('Testimonials GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new testimonial
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate required fields
    if (!body.rating || !body.text) {
      return NextResponse.json(
        { error: 'Rating and text are required' },
        { status: 400 }
      )
    }

    // Validate rating
    if (body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Validate text length
    if (body.text.length < 10) {
      return NextResponse.json(
        { error: 'Testimonial must be at least 10 characters' },
        { status: 400 }
      )
    }

    if (body.text.length > 1000) {
      return NextResponse.json(
        { error: 'Testimonial must be less than 1000 characters' },
        { status: 400 }
      )
    }

    // Get user's profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single()

    // Get user's trade count
    const { count: tradesCount } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Prepare testimonial data
    const testimonialData = {
      user_id: user.id,
      user_name: body.user_name || profile?.full_name || user.email?.split('@')[0] || 'Anonymous',
      user_email: user.email,
      rating: parseInt(body.rating),
      text: body.text.trim(),
      role: body.role || null,
      profile_image_url: body.profile_image_url || profile?.avatar_url || null,
      is_verified: !!user.email, // Auto-verify if they have email
      is_featured: false,
      status: 'approved', // Auto-approve for now
      trades_logged: tradesCount || 0,
      prop_firms_passed: body.prop_firms_passed || 0
    }

    // Insert testimonial
    const { data: testimonial, error: insertError } = await supabase
      .from('testimonials')
      .insert(testimonialData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating testimonial:', insertError)
      return NextResponse.json(
        { error: 'Failed to create testimonial' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      testimonial,
      message: 'Testimonial submitted successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Testimonial POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete testimonial (user's own)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const testimonialId = searchParams.get('id')

    if (!testimonialId) {
      return NextResponse.json(
        { error: 'Testimonial ID is required' },
        { status: 400 }
      )
    }

    // Delete testimonial (RLS will ensure user can only delete their own)
    const { error: deleteError } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', testimonialId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting testimonial:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete testimonial' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Testimonial deleted successfully'
    })
  } catch (error) {
    console.error('Testimonial DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}