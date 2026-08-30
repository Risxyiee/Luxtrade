export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { ACHIEVEMENTS, getAchievementById } from '@/lib/achievements-data'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    // Auth: get the REAL user from session, NOT from request body
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use authenticated user's ID — ignore any userId from body
    const userId = authUser.id

    // Safety: ensure userId is not null/undefined before any DB operation
    if (!userId) {
      console.error('[missions/claim] authUser.id is falsy:', JSON.stringify(authUser))
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 401 })
    }

    const { missionId, proofUrl } = await request.json()

    if (!missionId) {
      return NextResponse.json(
        { error: 'Mission ID is required' },
        { status: 400 }
      )
    }

    const achievement = getAchievementById(missionId)
    if (!achievement) {
      return NextResponse.json(
        { error: 'Achievement not found' },
        { status: 404 }
      )
    }

    // Ensure profile exists
    let profile = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Get user's submissions and achievements
    const submissions = await db.userSubmission.findMany({
      where: { userId }
    })

    const existingClaim = submissions.find(
      s => s.achievementKey === missionId && s.status === 'APPROVED'
    )

    if (existingClaim) {
      return NextResponse.json(
        { error: 'Achievement already claimed' },
        { status: 400 }
      )
    }

    let isValid = false
    let validationMessage = ''

    if (achievement.type === 'automatic') {
      isValid = await validateAutomaticAchievement(userId, achievement, profile)
      validationMessage = isValid ? 'Criteria met!' : 'Criteria not met yet'
    } else {
      if (!proofUrl) {
        return NextResponse.json(
          { error: 'Proof URL is required for manual achievements' },
          { status: 400 }
        )
      }
      isValid = true
      validationMessage = 'Proof submitted for review'
    }

    if (!isValid && achievement.type === 'automatic') {
      return NextResponse.json(
        { error: validationMessage, isValid: false },
        { status: 400 }
      )
    }

    const status = achievement.type === 'automatic' ? 'APPROVED' : 'PENDING'

    // Create submission
    console.log(`[missions/claim] Creating submission for userId="${userId}" (type: ${typeof userId}, len: ${userId?.length})`)
    const submission = await db.userSubmission.create({
      data: {
        userId: String(userId),
        achievementKey: missionId,
        proofUrl: proofUrl || null,
        status,
        reviewedBy: achievement.type === 'automatic' ? 'SYSTEM' : null,
      }
    })

    if (!submission) {
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 }
      )
    }

    // Add achievement to profile and apply reward if approved
    if (achievement.type === 'automatic' && status === 'APPROVED') {
      const achievements = (profile.achievements as string[]) || []
      await db.profile.update({
        where: { id: userId },
        data: {
          achievements: [...achievements, missionId]
        }
      })
      await applyReward(userId, achievement)
    }

    // Update or create mission progress
    const missionProgress = await db.missionProgress.findUnique({
      where: {
        userId_missionKey: {
          userId,
          missionKey: missionId
        }
      }
    })

    if (missionProgress) {
      await db.missionProgress.update({
        where: { id: missionProgress.id },
        data: {
          progress: missionProgress.target,
          completed: true,
          claimed: true,
        }
      })
    } else {
      await db.missionProgress.create({
        data: {
          userId,
          missionKey: missionId,
          progress: 1,
          target: 1,
          completed: true,
          claimed: true,
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: achievement.type === 'automatic'
        ? `Achievement "${achievement.title}" claimed! Reward applied: ${achievement.reward.label}`
        : `Achievement "${achievement.title}" submitted for review`,
      achievement,
      rewardApplied: achievement.type === 'automatic',
      status
    })

  } catch (error) {
    console.error('[missions/claim] Error:', error)
    return NextResponse.json(
      { error: 'Failed to claim achievement' },
      { status: 500 }
    )
  }
}

async function validateAutomaticAchievement(
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
        console.log(`[Achievement Validator] Trade count: ${totalTrades}, Target: ${achievement.criteria.target}`)
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
        console.log(`[Achievement Validator] Total profit: $${totalProfit}, Target: $${achievement.criteria.target}`)
        return totalProfit >= achievement.criteria.target

      case 'win_streak':
        const winTrades = await db.trade.findMany({
          where: {
            user_id: userId,
            profit_loss: { gt: 0 }
          },
          orderBy: { close_time: 'desc' },
          select: { profit_loss: true, close_time: true }
        })

        let currentStreak = 0
        if (winTrades && winTrades.length > 0) {
          currentStreak = winTrades.length
        }
        console.log(`[Achievement Validator] Win streak: ${currentStreak}, Target: ${achievement.criteria.target}`)
        return currentStreak >= achievement.criteria.target

      case 'login_streak':
        const streakCount = profile.streakCount || 0
        console.log(`[Achievement Validator] Login streak: ${streakCount}, Target: ${achievement.criteria.target}`)
        return streakCount >= achievement.criteria.target

      default:
        return false
    }
  } catch (error) {
    console.error('[Achievement Validator] Error validating achievement:', error)
    return false
  }
}

async function applyReward(userId: string, achievement: any) {
  try {
    switch (achievement.reward.type) {
      case 'pro_days':
        const daysToAdd = achievement.reward.value as number
        const profile = await db.profile.findUnique({
          where: { id: userId }
        })

        if (!profile) {
          console.error('[Achievement Reward] Profile not found when applying reward')
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

        console.log(`[Achievement Reward] Applied ${daysToAdd} days PRO to user ${userId}`)
        break

      case 'special_feature':
      case 'badge':
        // TODO: Implement badge and special feature rewards
        break
    }
  } catch (error) {
    console.error('[Achievement Reward] Error applying reward:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth: require login to view own missions
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.id

    const profile = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const submissions = await db.userSubmission.findMany({
      where: { userId }
    })

    const achievements = (profile.achievements as string[]) || []
    const claimedAchievements = submissions
      .filter(s => s.status === 'APPROVED')
      .map(s => s.achievementKey)

    const progressData = await Promise.all(
      ACHIEVEMENTS.map(async (achievement) => {
        let currentProgress = 0
        const target = achievement.criteria.target
        const isCompleted = achievements.includes(achievement.id) || claimedAchievements.includes(achievement.id)
        const isClaimed = claimedAchievements.includes(achievement.id)

        switch (achievement.criteria.type) {
          case 'trade_count':
            const tradesCount = await db.trade.count({
              where: { user_id: userId }
            })

            currentProgress = tradesCount || 0
            break

          case 'profit':
            const trades = await db.trade.findMany({
              where: {
                user_id: userId,
                profit_loss: { gt: 0 }
              },
              select: { profit_loss: true }
            })

            currentProgress = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0)
            break

          case 'login_streak':
            currentProgress = profile.streakCount || 0
            break

          case 'win_streak':
            const winTrades = await db.trade.findMany({
              where: {
                user_id: userId,
                profit_loss: { gt: 0 }
              },
              orderBy: { close_time: 'desc' },
              select: { profit_loss: true, close_time: true }
            })

            let currentStreak = 0
            if (winTrades && winTrades.length > 0) {
              currentStreak = winTrades.length
            }
            currentProgress = currentStreak
            break

          default:
            currentProgress = isCompleted ? target : 0
        }

        return {
          id: achievement.id,
          title: achievement.title,
          progress: Math.min(currentProgress, target),
          target,
          isCompleted,
          isClaimed,
          canClaim: !isClaimed && currentProgress >= target
        }
      })
    )

    return NextResponse.json({
      achievements: progressData,
      totalCompleted: achievements.length,
      totalClaimed: claimedAchievements.length,
      streakCount: profile.streakCount || 0,
      bestStreak: profile.bestStreak || 0
    })

  } catch (error) {
    console.error('[missions/claim GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mission status' },
      { status: 500 }
    )
  }
}