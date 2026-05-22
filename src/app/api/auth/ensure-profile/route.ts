import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, fullName } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured')
      return NextResponse.json(
        { error: 'Admin access not configured' },
        { status: 500 }
      )
    }

    console.log('🔄 Ensuring profile exists for user:', userId)

    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching profile:', fetchError)
      return NextResponse.json(
        { error: 'Failed to check profile' },
        { status: 500 }
      )
    }

    if (existingProfile) {
      console.log('✅ Profile already exists')
      return NextResponse.json({ profile: existingProfile, created: false })
    }

    // Create new profile using service role (bypasses RLS)
    console.log('📝 Creating new profile with admin privileges...')
    const { data: profile, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email: email || null,
        full_name: fullName || null,
        plan: 'FREE',
        is_pro: false,
        role: 'USER',
        subscription_status: 'FREE',
        streakCount: 0,
        bestStreak: 0,
        achievements: [],
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error creating profile:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Failed to create profile' },
        { status: 500 }
      )
    }

    console.log('✅ Profile created successfully')
    return NextResponse.json({ profile, created: true })
  } catch (error: any) {
    console.error('❌ Ensure profile error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
