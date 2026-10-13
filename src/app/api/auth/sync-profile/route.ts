import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// GET - Sync current user profile (ensure profile exists)
export async function GET(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const userId = user.id
    const email = user.email

    // Check or create profile
    const { data: existingProfile, error: findErr } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    let profile = existingProfile

    if (findErr || !existingProfile) {
      console.log('📝 Creating profile for user:', userId)
      const now = new Date().toISOString()
      const { data: newProfile, error: createErr } = await admin
        .from('profiles')
        .insert({
          id: userId,
          email: email || null,
          plan: 'FREE',
          is_pro: false,
          role: 'USER',
          streak_count: 0,
          best_streak: 0,
          achievements: '[]',
          created_at: now,
          updated_at: now,
        })
        .single()

      if (createErr) {
        console.error('❌ Failed to create profile:', createErr.message)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }
      profile = newProfile
      console.log('✅ Profile created for user:', userId)
    } else if (email && profile.email !== email) {
      // Update email if changed
      const { data: updatedProfile, error: updateErr } = await admin
        .from('profiles')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('*')
        .single()

      if (!updateErr && updatedProfile) {
        profile = updatedProfile
        console.log('✅ Profile email updated for user:', userId)
      }
    }

    // Count user trades
    let tradeCount = 0
    try {
      const { count } = await admin
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      tradeCount = count || 0
    } catch {
      // trade count failure is non-critical
    }

    return NextResponse.json({
      success: true,
      profile,
      stats: {
        tradeCount
      }
    })
  } catch (error) {
    console.error('Sync profile error:', error)
    return NextResponse.json(
      { error: 'Failed to sync profile' },
      { status: 500 }
    )
  }
}
