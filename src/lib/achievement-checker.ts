import { ACHIEVEMENTS } from './achievements-data'
import { db } from '@/lib/db'

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
    if (!userId) {
      console.log('[Achievement Checker] No userId provided')
      return []
    }

    // Verify profile exists before any DB writes
    const profile = await db.profile.findUnique({
      where: { id: userId }
    })

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
      const isMet = await checkAchievementCriteria(userId, achievement, profile)

      if (isMet) {
        console.log(`[Achievement Checker] Achievement "${achievement.title}" is now complete!`)

        // Add achievement to profile
        await db.profile.update({
          where: { id: userId },
          data: {
            achievements: [...claimedAchievementIds, achievement.id]
          }
        })

        // Create submission record for tracking
        await db.userSubmission.create({
          data: {
            userId,
            achievementKey: achievement.id,
            proofUrl: null,
            status: 'APPROVED',
            reviewedBy: 'SYSTEM',
          }
        })

        // Create or update mission progress
        await db.missionProgress.upsert({
          where: {
            userId_missionKey: {
              userId,
              missionKey: achievement.id
            }
          },
          create: {
            userId,
            missionKey: achievement.id,
            progress: achievement.criteria.target,
            target: achievement.criteria.target,
            completed: true,
            claimed: true,
          },
          update: {
            progress: achievement.criteria.target,
            completed: true,
            claimed: true,
          }
        })

        // Apply reward immediately
        await applyReward(userId, achievement)

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
        const tradesCount = await db.trade.count({
          where: { user_id: userId }
        })

        const totalTrades = tradesCount || 0
        console.log(`[Achievement Checker] Trade count: ${totalTrades}, Target: ${achievement.criteria.target}`)
        return totalTrades >= achievement.criteria.target

      case 'profit':
        const trades = await db.trade.findMany({
          where: {
            user_id: userId,
            profit_loss: { gt: 0 }
          },
          select: { profit_loss: true }
        })

        const totalProfit = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0)
        console.log(`[Achievement Checker] Total profit: $${totalProfit}, Target: $${achievement.criteria.target}`)
        return totalProfit >= achievement.criteria.target

      case 'win_streak':
        const winTrades = await db.trade.findMany({
          where: {
            user_id: userId,
            profit_loss: { gt: 0 }
          },
          orderBy: { close_time: 'desc' },
          select: { profit_loss: true }
        })

        let currentStreak = 0
        if (winTrades && winTrades.length > 0) {
          currentStreak = winTrades.length // All positive trades count as win streak
        }
        console.log(`[Achievement Checker] Win streak: ${currentStreak}, Target: ${achievement.criteria.target}`)
        return currentStreak >= achievement.criteria.target

      case 'login_streak':
        const streakCount = profile.streakCount || 0
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
 * Apply achievement reward to user
 */
async function applyReward(userId: string, achievement: any): Promise<void> {
  try {
    switch (achievement.reward.type) {
      case 'pro_days':
        const daysToAdd = achievement.reward.value as number
        const profile = await db.profile.findUnique({
          where: { id: userId }
        })

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

        await db.profile.update({
          where: { id: userId },
          data: {
            subscription_until: newExpiry.toISOString(),
            plan: 'PRO',
            is_pro: true,
          }
        })

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
