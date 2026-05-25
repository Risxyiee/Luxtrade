import { db } from '@/lib/db'

/**
 * Update user's login streak when they login
 * Called from auth context when user successfully logs in
 */
export async function updateLoginStreak(userId: string): Promise<number> {
  try {
    const profile = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!profile) {
      console.log('[Streak Tracker] Profile not found, creating...')
      await db.profile.create({
        data: {
          id: userId,
          streakCount: 1,
          bestStreak: 1,
          lastLoginAt: new Date(),
        }
      })
      return 1
    }

    const now = new Date()
    const lastLogin = profile.lastLoginAt ? new Date(profile.lastLoginAt) : null

    // Calculate days difference
    let newStreak = 1
    let updateData: any = {
      lastLoginAt: now,
    }

    if (lastLogin) {
      const diffTime = now.getTime() - lastLogin.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      console.log(`[Streak Tracker] Days since last login: ${diffDays}`)

      if (diffDays === 0) {
        // Same day login - don't update streak
        console.log('[Streak Tracker] Same day login, streak unchanged')
        return profile.streakCount || 0
      } else if (diffDays === 1) {
        // Consecutive day - increment streak
        newStreak = (profile.streakCount || 0) + 1
        console.log(`[Streak Tracker] Consecutive day! New streak: ${newStreak}`)
      } else {
        // Streak broken - reset to 1
        console.log('[Streak Tracker] Streak broken, resetting to 1')
        newStreak = 1
      }

      updateData.streakCount = newStreak

      // Update best streak if needed
      const bestStreak = profile.bestStreak || 0
      if (newStreak > bestStreak) {
        updateData.bestStreak = newStreak
      }
    } else {
      // First login
      console.log('[Streak Tracker] First login, setting streak to 1')
      updateData.streakCount = 1
      updateData.bestStreak = 1
    }

    await db.profile.update({
      where: { id: userId },
      data: updateData
    })

    console.log(`[Streak Tracker] Updated streak for user ${userId}: ${newStreak}`)
    return newStreak
  } catch (error) {
    console.error('[Streak Checker] Error updating login streak:', error)
    return 0
  }
}

/**
 * Check and update achievements based on login streak
 */
export async function checkStreakAchievements(userId: string, streak: number): Promise<void> {
  try {
    const profile = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!profile) return

    const claimedAchievements = profile.achievements || []

    // Import achievements data
    const { ACHIEVEMENTS } = await import('./achievements-data')

    // Check login streak achievements
    const streakAchievements = ACHIEVEMENTS.filter(
      a => a.criteria.type === 'login_streak' && a.type === 'automatic'
    )

    for (const achievement of streakAchievements) {
      // Skip if already claimed
      if (claimedAchievements.includes(achievement.id)) {
        continue
      }

      // Check if streak meets target
      if (streak >= achievement.criteria.target) {
        console.log(`[Streak Tracker] Achievement unlocked: ${achievement.title}`)

        // Add achievement to profile
        await db.profile.update({
          where: { id: userId },
          data: {
            achievements: [...claimedAchievements, achievement.id]
          }
        })

        // Apply reward
        if (achievement.reward.type === 'pro_days') {
          const daysToAdd = achievement.reward.value as number
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

          console.log(`[Streak Tracker] Applied ${daysToAdd} days PRO for achievement: ${achievement.title}`)
        }
      }
    }
  } catch (error) {
    console.error('[Streak Tracker] Error checking streak achievements:', error)
  }
}
