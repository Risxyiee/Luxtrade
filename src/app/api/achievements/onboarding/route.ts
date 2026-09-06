import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

let _supabase: SupabaseClient | null = null
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing Supabase env vars')
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Achievement IDs
const ONBOARDING_ACHIEVEMENT_ID = 'newcomer_achievement'

// Helper function to check if table exists using .or() filter
async function tableExists(client: SupabaseClient, tableName: string): Promise<boolean> {
  try {
    const { error } = await client
      .from(tableName)
      .select('*')
      .limit(1)
      .or('id.eq.00000000-0000-0000-0000-000000000000')
    // If we get PGRST204 or PGRST205, table doesn't exist
    if (error && (error.code === 'PGRST204' || error.code === 'PGRST205')) {
      return false
    }
    if (error && error.code === '42P01') {
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await requireAuth(request)
    const response = authResult.response
    const user = authResult.user
    if (response) return response

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, username } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // SECURITY: Only allow awarding achievements to the authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: cannot award achievements to another user' },
        { status: 403 }
      )
    }

    const supabase = getSupabase()

    // Step 1: Check if achievements table exists
    const achievementsTableExists = await tableExists(supabase, 'achievements')

    if (!achievementsTableExists) {
      console.log('[onboarding achievement] Achievements table does not exist, returning success')
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

    // Step 2: Check if user already has this achievement (use maybeSingle to handle missing data gracefully)
    let alreadyEarned = false
    try {
      const { data: existingAchievement, error: checkError } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .eq('achievement_id', ONBOARDING_ACHIEVEMENT_ID)
        .maybeSingle()

      if (checkError) {
        // Handle specific error codes
        if (checkError.code === 'PGRST116') {
          // No rows returned - user hasn't earned the achievement yet
          alreadyEarned = false
        } else if (checkError.code === '42P01' || checkError.code === 'PGRST204' || checkError.code === 'PGRST205') {
          // Table doesn't exist or column doesn't exist - treat as not earned
          console.log('[onboarding achievement] user_achievements table/column does not exist')
          alreadyEarned = false
        } else {
          console.warn('[onboarding achievement] Error checking existing achievement:', checkError)
          alreadyEarned = false
        }
      } else if (existingAchievement) {
        alreadyEarned = true
      }
    } catch (err) {
      console.warn('[onboarding achievement] Exception checking existing achievement:', err)
      alreadyEarned = false
    }

    if (alreadyEarned) {
      return NextResponse.json({
        success: true,
        message: 'Achievement already earned',
        alreadyEarned: true,
      })
    }

    // Step 3: Create the onboarding achievement if it doesn't exist
    try {
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
        .maybeSingle()

      if (achievementError) {
        if (achievementError.code !== 'PGRST116') {
          console.warn('[onboarding achievement] Error creating achievement:', achievementError)
        }
      }
    } catch (err) {
      console.warn('[onboarding achievement] Exception creating achievement:', err)
    }

    // Step 4: Award the achievement to the user
    let userAchievement = null
    try {
      const insertData: any = {
        user_id: userId,
        achievement_id: ONBOARDING_ACHIEVEMENT_ID,
        earned_at: new Date().toISOString(),
      }

      // Add achievement_key field if column exists
      const { error: columnCheckError } = await supabase
        .from('user_achievements')
        .select('achievement_key')
        .limit(1)
        .or('id.eq.00000000-0000-0000-0000-000000000000')

      if (!columnCheckError || columnCheckError.code !== 'PGRST116') {
        insertData.achievement_key = ONBOARDING_ACHIEVEMENT_ID
      }

      const { data: userData, error: awardError } = await supabase
        .from('user_achievements')
        .insert(insertData)
        .select(`
          *,
          achievements (*)
        `)
        .maybeSingle()

      if (awardError) {
        if (awardError.code === '23505') {
          // Unique constraint violation - already earned (race condition)
          console.log('[onboarding achievement] Achievement already earned (race condition)')
          userAchievement = {
            id: ONBOARDING_ACHIEVEMENT_ID,
            title: 'Newcomer',
            xp_reward: 10,
          }
        } else if (awardError.code === '42P01' || awardError.code === 'PGRST204' || awardError.code === 'PGRST205') {
          // Table doesn't exist
          console.log('[onboarding achievement] user_achievements table does not exist')
          userAchievement = null
        } else {
          console.warn('[onboarding achievement] Error awarding achievement:', awardError)
          userAchievement = null
        }
      } else {
        userAchievement = userData
      }
    } catch (err) {
      console.warn('[onboarding achievement] Exception awarding achievement:', err)
      userAchievement = null
    }

    // Step 5: Update user XP (non-critical - won't block success response)
    let newXP = null
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('total_xp')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        if (profileError.code === '42P01' || profileError.code === 'PGRST204' || profileError.code === 'PGRST205') {
          console.log('[onboarding achievement] profiles table does not exist')
        } else {
          console.warn('[onboarding achievement] Error fetching profile:', profileError)
        }
      } else if (profile) {
        newXP = (profile?.total_xp || 0) + 10
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ total_xp: newXP })
          .eq('id', userId)

        if (updateError) {
          console.warn('[onboarding achievement] Error updating XP:', updateError)
        }
      }
    } catch (err) {
      console.warn('[onboarding achievement] Exception updating XP:', err)
    }

    // Return success response even if some database operations failed
    return NextResponse.json({
      success: true,
      message: userAchievement ? 'Achievement unlocked!' : 'Onboarding completed',
      achievement: userAchievement || {
        id: ONBOARDING_ACHIEVEMENT_ID,
        title: 'Newcomer',
        xp_reward: 10,
      },
      xpEarned: 10,
      totalXP: newXP,
    })
  } catch (error) {
    console.error('[onboarding achievement] Unexpected error:', error)
    // Always return success so the UI shows the completion
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
}