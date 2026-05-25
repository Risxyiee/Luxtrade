import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Achievement IDs
const ONBOARDING_ACHIEVEMENT_ID = 'newcomer_achievement'

export async function POST(request: NextRequest) {
  try {
    const { userId, username } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check if user already has this achievement
    const { data: existingAchievement, error: checkError } = await supabase
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
    const { error: tableError } = await supabase
      .from('achievements')
      .select('id')
      .limit(1)

    if (tableError && tableError.code === '42P01') {
      // Table doesn't exist, we'll handle it gracefully
      console.log('Achievements table does not exist, skipping database update')
    }

    // Create the onboarding achievement if it doesn't exist
    const { data: achievementData, error: achievementError } = await supabase
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
    const { data: userAchievement, error: awardError } = await supabase
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', userId)
      .single()

    // Update user XP
    const newXP = (profile?.total_xp || 0) + 10
    await supabase
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
