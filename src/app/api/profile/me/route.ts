import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export async function GET(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Read from Supabase profiles table (source of truth — same as admin activate writes to)
    const admin = getSupabaseAdmin()
    if (!admin) {
      console.error('❌ [profile/me] Supabase admin client not available')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, full_name, plan, is_pro, subscription_until, pro_expiry, pro_status, role, achievements, streak_count, best_streak, my_referral_code, display_name, subscription_status, device_id, has_ever_been_pro, referral_status, referred_by_code, commission_paid, affiliate_balance, referral_count, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      // Handle table or column errors gracefully
      console.warn(`[profile/me] Profile fetch error for ${user.id}:`, profileError)
      if (
        profileError.code === '42P01' || // Table doesn't exist
        profileError.code === 'PGRST204' || // Column not found
        profileError.code === 'PGRST205' || // Column not found in select
        profileError.message?.includes('does not exist') ||
        profileError.message?.includes('column')
      ) {
        // Return a basic profile from auth data only
        return NextResponse.json({
          profile: {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
            display_name: user.user_metadata?.display_name || null,
            plan: 'FREE',
            is_pro: false,
            subscription_status: 'inactive',
            subscription_until: null,
            proExpiry: null,
            pro_status: 'inactive',
            role: user.user_metadata?.role || 'USER',
            achievements: '[]',
            streakCount: 0,
            bestStreak: 0,
            my_referral_code: null,
            referred_by_code: null,
            referral_status: null,
            has_ever_been_pro: false,
            device_id: null,
            created_at: user.created_at,
            _fallback: true, // Flag indicating we're using fallback data
          }
        })
      }
      return NextResponse.json({ error: 'Failed to fetch profile', detail: profileError.message }, { status: 500 })
    }

    if (!profile) {
      console.warn(`[profile/me] No profile found for ${user.id}, returning null profile`)
      return NextResponse.json({ profile: null })
    }

    // Determine effective PRO status
    const untilStr = profile.subscription_until || profile.pro_expiry
    const isProActive = profile.is_pro && untilStr && new Date(untilStr) > new Date()

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email || user.email,
        full_name: profile.full_name || user.user_metadata?.full_name || null,
        display_name: profile.display_name || user.user_metadata?.display_name || null,
        plan: isProActive ? 'PRO' : (profile.plan || 'FREE'),
        is_pro: isProActive,
        subscription_status: isProActive ? 'active' : (profile.subscription_status || 'inactive'),
        subscription_until: untilStr || null,
        proExpiry: profile.pro_expiry || null,
        pro_status: profile.pro_status || 'inactive',
        role: profile.role || user.user_metadata?.role || 'USER',
        achievements: profile.achievements || '[]',
        streakCount: profile.streak_count || 0,
        bestStreak: profile.best_streak || 0,
        my_referral_code: profile.my_referral_code || null,
        referred_by_code: profile.referred_by_code || null,
        referral_status: profile.referral_status || null,
        has_ever_been_pro: profile.has_ever_been_pro ?? false,
        device_id: profile.device_id || null,
        created_at: profile.created_at || user.created_at,
      }
    })
  } catch (error: any) {
    console.error('❌ [profile/me] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}