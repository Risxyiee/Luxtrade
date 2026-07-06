import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing Supabase env vars')
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Achievement IDs
const ONBOARDING_ACHIEVEMENT_ID = 'newcomer_achievement'

export async function POST(request: NextRequest) {
  try {
    const { userId, username } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check if user already has this achievement
    const { data: existingAchievement, error: checkError } = await getSupabase()
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .eq('achievement_id', ONBOARDING_ACHIEVEMENT_ID)
      .single()

    if (existingAchievement) {
      return NextResponse.json({
        success: true,
        message: 'Achievement already earned',
        alreadyEarned: true,
      })
    }

    // Check if achievements table exists, if not create it
    const { error: tableError } = await getSupabase()
      .from('achievements')
      .select('id')
      .limit(1)

    if (tableError && tableError.code === '42P01') {
      // Table doesn't exist, we'll handle it gracefully
      console.log('Achievements table does not exist, skipping database update')
    }

    // Create the onboarding achievement if it doesn't exist
    const { data: achievementData, error: achievementError } = await getSupabase()
      .from('achievements')
      .upsert(
        {
          id: ONBOARDING_ACHIEVEMENT_ID,
          title: 'Newcomer',
          title_id: 'Pendatang Baru',
          description: 'Completed the Welcome Guide',
          description_id: 'Menyelesaikan Guide Selamat Datang',
          xp_reward: 10,
          icon: 'trophy',
          category: 'onboarding',
          rarity: 'common',
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (achievementError && achievementError.code !== 'PGRST116') {
      console.error('Error creating achievement:', achievementError)
    }

    // Award the achievement to the user
    const { data: userAchievement, error: awardError } = await getSupabase()
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: ONBOARDING_ACHIEVEMENT_ID,
        earned_at: new Date().toISOString(),
      })
      .select(`
        *,
        achievements (*)
      `)
      .single()

    if (awardError) {
      console.error('Error awarding achievement:', awardError)
      // Still return success so the UI shows the completion
      return NextResponse.json({
        success: true,
        message: 'Onboarding completed',
        achievement: {
          id: ONBOARDING_ACHIEVEMENT_ID,
          title: 'Newcomer',
          xp_reward: 10,
        },
        xpEarned: 10,
        localOnly: true,
      })
    }

    // Get current user XP
    const { data: profile } = await getSupabase()
      .from('profiles')
      .select('total_xp')
      .eq('id', userId)
      .single()

    // Update user XP
    const newXP = (profile?.total_xp || 0) + 10
    await getSupabase()
      .from('profiles')
      .update({ total_xp: newXP })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      message: 'Achievement unlocked!',
      achievement: userAchievement,
      xpEarned: 10,
      totalXP: newXP,
    })
  } catch (error) {
    console.error('Error in onboarding achievement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
