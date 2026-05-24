import { ACHIEVEMENTS } from './achievements-data'
import { supabase } from './supabase'
import {
  getUserSubmissions,
  getMissionProgressByKey,
  upsertMissionProgress,
  createUserSubmission,
  addAchievementToProfile,
  ensureProfileExists,
} from './supabase-db'

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
export async function checkAchievementsAfterTrade(userId: string): Promise<AchievementResult[]> {
  try {
    if (!userId) {
      console.log('[Achievement Checker] No userId provided')
      return []
    }

    // Ensure profile exists
    const profile = await ensureProfileExists(userId)
    if (!profile) {
      console.log('[Achievement Checker] Failed to get profile')
      return []
    }

    // Get user's existing submissions
    const submissions = await getUserSubmissions(userId)
    const claimedAchievementIds = submissions
      .filter(s => s.status === 'APPROVED')
      .map(s => s.achievement_key)

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
      const isMet = await checkAchievementCriteria(userId, achievement, profile)

      if (isMet) {
        console.log(`[Achievement Checker] Achievement "${achievement.title}" is now complete!`)

        // Update mission progress
        const existingProgress = await getMissionProgressByKey(userId, achievement.id)

        await upsertMissionProgress({
          userId,
          missionKey: achievement.id,
          progress: achievement.criteria.target,
          target: achievement.criteria.target,
          completed: true,
          claimed: false,
        })

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
  profile: any
): Promise<boolean> {
  try {
    switch (achievement.criteria.type) {
      case 'trade_count':
        const tradesCount = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        const totalTrades = tradesCount.count || 0
        console.log(`[Achievement Checker] Trade count: ${totalTrades}, Target: ${achievement.criteria.target}`)
        return totalTrades >= achievement.criteria.target

      case 'profit':
        const { data: profitData } = await supabase
          .from('trades')
          .select('profit_loss')
          .eq('user_id', userId)
          .gt('profit_loss', 0)

        const totalProfit = (profitData || []).reduce((sum, t) => sum + (t.profit_loss || 0), 0)
        console.log(`[Achievement Checker] Total profit: $${totalProfit}, Target: $${achievement.criteria.target}`)
        return totalProfit >= achievement.criteria.target

      case 'win_streak':
        const { data: winTrades } = await supabase
          .from('trades')
          .select('profit_loss, close_time')
          .eq('user_id', userId)
          .gt('profit_loss', 0)
          .order('close_time', { ascending: false })

        let currentStreak = 0
        if (winTrades && winTrades.length > 0) {
          currentStreak = 1
          for (let i = 1; i < winTrades.length; i++) {
            currentStreak++
          }
        }
        console.log(`[Achievement Checker] Win streak: ${currentStreak}, Target: ${achievement.criteria.target}`)
        return currentStreak >= achievement.criteria.target

      case 'login_streak':
        const streakCount = profile.streak_count || 0
        console.log(`[Achievement Checker] Login streak: ${streakCount}, Target: ${achievement.criteria.target}`)
        return streakCount >= achievement.criteria.target

      default:
        return false
    }
  } catch (error) {
    console.error('[Achievement Checker] Error checking criteria:', error)
    return false
  }
}

/**
 * Automatically claim an achievement (for automatic types)
 */
export async function autoClaimAchievement(userId: string, achievementId: string): Promise<boolean> {
  try {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)
    if (!achievement || achievement.type !== 'automatic') {
      console.log('[Achievement Checker] Invalid achievement or not automatic')
      return false
    }

    // Create submission
    const submission = await createUserSubmission({
      userId,
      achievementKey: achievementId,
      status: 'APPROVED',
      reviewedBy: 'SYSTEM',
    })

    if (!submission) {
      console.log('[Achievement Checker] Failed to create submission')
      return false
    }

    // Add achievement to profile
    await addAchievementToProfile(userId, achievementId)

    // Update mission progress
    await upsertMissionProgress({
      userId,
      missionKey: achievementId,
      progress: achievement.criteria.target,
      target: achievement.criteria.target,
      completed: true,
      claimed: true,
    })

    // Apply reward
    await applyReward(userId, achievement)

    console.log(`[Achievement Checker] Achievement "${achievement.title}" auto-claimed successfully`)
    return true
  } catch (error) {
    console.error('[Achievement Checker] Error auto-claiming achievement:', error)
    return false
  }
}

/**
 * Apply achievement reward to user
 */
async function applyReward(userId: string, achievement: any): Promise<void> {
  try {
    switch (achievement.reward.type) {
      case 'pro_days':
        const daysToAdd = achievement.reward.value as number
        const { getProfile, updateProfile } = await import('./supabase-db')
        const profile = await getProfile(userId)

        if (!profile) {
          console.error('[Achievement Checker] Profile not found when applying reward')
          return
        }

        const currentExpiry = profile.pro_expiry ? new Date(profile.pro_expiry) : null
        const now = new Date()

        let newExpiry: Date
        if (!currentExpiry || currentExpiry < now) {
          newExpiry = new Date()
        } else {
          newExpiry = new Date(currentExpiry)
        }

        newExpiry.setDate(newExpiry.getDate() + daysToAdd)

        await updateProfile(userId, {
          pro_expiry: newExpiry.toISOString(),
          plan: 'PRO',
        })

        // Update Supabase Auth metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            is_pro: true,
            subscription_status: 'active',
            subscription_until: newExpiry.toISOString(),
          }
        })

        if (updateError) {
          console.error('[Achievement Checker] Error updating user metadata:', updateError)
        }

        console.log(`[Achievement Checker] Applied ${daysToAdd} days PRO to user ${userId}`)
        break

      case 'special_feature':
      case 'badge':
        // TODO: Implement badge and special feature rewards
        break
    }
  } catch (error) {
    console.error('[Achievement Checker] Error applying reward:', error)
  }
}
