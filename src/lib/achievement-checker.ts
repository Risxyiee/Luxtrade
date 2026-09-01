import { ACHIEVEMENTS } from './achievements-data'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export interface AchievementResult {
  id: string
  title: string
  reward: string
  unlocked: boolean
  alreadyClaimed: boolean
}

/**
 * Check achievements after a trade is created/updated
 * Returns list of achievements that are now complete and can be claimed
 */
export async function checkAchievementsAfterTrade(userId: string | undefined | null): Promise<AchievementResult[]> {
  try {
    // ── Safety: ensure userId is a valid non-empty string before any DB writes ──
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.warn('[Achievement Checker] No valid userId provided, skipping')
      return []
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      console.warn('[Achievement Checker] Supabase admin client not available')
      return []
    }

    // Verify profile exists before any DB writes
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profile) {
      console.log(`[Achievement Checker] No profile found for userId=${userId}`)
      return []
    }

    // Get user's claimed achievement IDs from profile.achievements array
    const claimedAchievementIds: string[] = Array.isArray(profile.achievements) ? profile.achievements : []

    // Check each automatic achievement
    const unlockedAchievements: AchievementResult[] = []

    for (const achievement of ACHIEVEMENTS) {
      // Skip if already claimed
      if (claimedAchievementIds.includes(achievement.id)) {
        continue
      }

      // Only check automatic achievements
      if (achievement.type !== 'automatic') {
        continue
      }

      // Check if achievement criteria is met
      const isMet = await checkAchievementCriteria(userId, achievement, profile, admin)

      if (isMet) {
        console.log(`[Achievement Checker] Achievement "${achievement.title}" is now complete! userId=${userId}`)

        // Add achievement to profile — re-fetch for race safety
        const { data: freshProfile } = await admin
          .from('profiles')
          .select('achievements')
          .eq('id', userId)
          .single()
        const currentAchievements: string[] = Array.isArray(freshProfile?.achievements) ? freshProfile.achievements : []
        if (currentAchievements.includes(achievement.id)) {
          console.log(`[Achievement Checker] Achievement "${achievement.title}" already claimed (race), skipping`)
          continue
        }

        await admin
          .from('profiles')
          .update({
            achievements: [...currentAchievements, achievement.id]
          })
          .eq('id', userId)

        // Create submission record for tracking — userId is guaranteed non-null here
        try {
          await admin
            .from('user_submissions')
            .insert({
              user_id: String(userId),
              achievement_key: achievement.id,
              proof_url: null,
              status: 'APPROVED',
              reviewed_by: 'SYSTEM',
            })
        } catch (submissionErr: any) {
          console.error(`[Achievement Checker] user_submissions insert failed for userId="${userId}":`, submissionErr.message)
          // Don't fail the whole achievement — the profile already has the badge
        }

        // Create or update mission progress (emulate upsert)
        try {
          // Check if mission_progress row exists
          const { data: existingMission } = await admin
            .from('mission_progress')
            .select('id')
            .eq('user_id', userId)
            .eq('mission_key', achievement.id)
            .maybeSingle()

          if (existingMission) {
            await admin
              .from('mission_progress')
              .update({
                progress: achievement.criteria.target,
                completed: true,
                claimed: true,
              })
              .eq('id', existingMission.id)
          } else {
            await admin
              .from('mission_progress')
              .insert({
                user_id: userId,
                mission_key: achievement.id,
                progress: achievement.criteria.target,
                target: achievement.criteria.target,
                completed: true,
                claimed: true,
              })
          }
        } catch (missionErr: any) {
          console.error(`[Achievement Checker] mission_progress upsert failed:`, missionErr.message)
        }

        // Apply reward immediately
        await applyReward(userId, achievement, admin)

        unlockedAchievements.push({
          id: achievement.id,
          title: achievement.title,
          reward: achievement.reward.label,
          unlocked: true,
          alreadyClaimed: false,
        })
      }
    }

    return unlockedAchievements
  } catch (error) {
    console.error('[Achievement Checker] Error checking achievements:', error)
    return []
  }
}

/**
 * Check if a specific achievement criteria is met
 */
async function checkAchievementCriteria(
  userId: string,
  achievement: any,
  profile: any,
  admin: ReturnType<typeof getSupabaseAdmin> & NonNullable<ReturnType<typeof getSupabaseAdmin>>
): Promise<boolean> {
  try {
    switch (achievement.criteria.type) {
      case 'trade_count': {
        const { count } = await admin
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        const totalTrades = count || 0
        console.log(`[Achievement Checker] Trade count: ${totalTrades}, Target: ${achievement.criteria.target}`)
        return totalTrades >= achievement.criteria.target
      }

      case 'profit': {
        const { data: trades } = await admin
          .from('trades')
          .select('profit_loss')
          .eq('user_id', userId)
          .gt('profit_loss', 0)

        const totalProfit = (trades || []).reduce((sum: number, t: any) => sum + (t.profit_loss || 0), 0)
        console.log(`[Achievement Checker] Total profit: $${totalProfit}, Target: $${achievement.criteria.target}`)
        return totalProfit >= achievement.criteria.target
      }

      case 'win_streak': {
        const { data: winTrades } = await admin
          .from('trades')
          .select('profit_loss')
          .eq('user_id', userId)
          .gt('profit_loss', 0)
          .order('close_time', { ascending: false })

        let currentStreak = 0
        if (winTrades && winTrades.length > 0) {
          currentStreak = winTrades.length // All positive trades count as win streak
        }
        console.log(`[Achievement Checker] Win streak: ${currentStreak}, Target: ${achievement.criteria.target}`)
        return currentStreak >= achievement.criteria.target
      }

      case 'login_streak': {
        const streakCount = profile.streak_count ?? profile.streakCount ?? 0
        console.log(`[Achievement Checker] Login streak: ${streakCount}, Target: ${achievement.criteria.target}`)
        return streakCount >= achievement.criteria.target
      }

      default:
        return false
    }
  } catch (error) {
    console.error('[Achievement Checker] Error checking criteria:', error)
    return false
  }
}

/**
 * Apply achievement reward to user
 */
async function applyReward(
  userId: string,
  achievement: any,
  admin: ReturnType<typeof getSupabaseAdmin> & NonNullable<ReturnType<typeof getSupabaseAdmin>>
): Promise<void> {
  try {
    switch (achievement.reward.type) {
      case 'pro_days': {
        const daysToAdd = achievement.reward.value as number
        const { data: profile } = await admin
          .from('profiles')
          .select('subscription_until')
          .eq('id', userId)
          .single()

        if (!profile) {
          console.error('[Achievement Checker] Profile not found when applying reward')
          return
        }

        const currentExpiry = profile.subscription_until ? new Date(profile.subscription_until) : null
        const now = new Date()

        let newExpiry: Date
        if (!currentExpiry || currentExpiry < now) {
          newExpiry = new Date()
        } else {
          newExpiry = new Date(currentExpiry)
        }

        newExpiry.setDate(newExpiry.getDate() + daysToAdd)

        await admin
          .from('profiles')
          .update({
            subscription_until: newExpiry.toISOString(),
            plan: 'PRO',
            is_pro: true,
          })
          .eq('id', userId)

        console.log(`[Achievement Checker] Applied ${daysToAdd} days PRO to user ${userId}`)
        break
      }

      case 'special_feature':
      case 'badge':
        // TODO: Implement badge and special feature rewards
        break
    }
  } catch (error) {
    console.error('[Achievement Checker] Error applying reward:', error)
  }
}
