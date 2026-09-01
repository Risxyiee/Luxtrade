import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { error, user } = await requireAuth(request)
    if (error) return error

    const body = await request.json()
    const { userId, email, fullName } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Only allow creating profile for the authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: cannot create profile for another user' },
        { status: 403 }
      )
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      )
    }

    // Check if profile already exists
    const { data: existingProfile, error: findErr } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!findErr && existingProfile) {
      return NextResponse.json({ profile: existingProfile, created: false })
    }

    // Create new profile using Supabase
    const profileData = {
      id: userId,
      email: email || user.email || null,
      full_name: fullName || null,
      plan: 'FREE',
      is_pro: false,
      role: 'USER',
      streak_count: 0,
      best_streak: 0,
      achievements: '[]',
    }

    const { data: newProfile, error: createErr } = await admin
      .from('profiles')
      .insert(profileData)
      .single()

    if (createErr) {
      console.error('❌ Failed to create profile:', createErr.message)
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile: newProfile, created: true })
  } catch (error: any) {
    console.error('❌ Ensure profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
