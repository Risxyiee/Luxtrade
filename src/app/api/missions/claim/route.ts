import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ACHIEVEMENTS, getAchievementById } from '@/lib/achievements-data'

export async function POST(request: NextRequest) {
  try {
    const { missionId, proofUrl, userId } = await request.json()

    if (!missionId || !userId) {
      return NextResponse.json(
        { error: 'Mission ID and User ID are required' },
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

    const profile = await db.profile.findUnique({
      where: { id: userId },
      include: {
        missionProgresses: true,
        submissions: true
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    const existingClaim = profile.submissions.find(
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

    const submission = await db.userSubmission.create({
      data: {
        userId,
        achievementKey: missionId,
        proofUrl: proofUrl || null,
        status,
        reviewedBy: achievement.type === 'automatic' ? 'SYSTEM' : null,
        reviewedAt: achievement.type === 'automatic' ? new Date() : null
      }
    })

    const currentAchievements = profile.achievements as string[] || []
    const newAchievements = [...currentAchievements, missionId]

    if (achievement.type === 'automatic' && status === 'APPROVED') {
      await applyReward(userId, achievement)
    }

    await db.profile.update({
      where: { id: userId },
      data: {
        achievements: newAchievements as any
      }
    })

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
          completed: true,
          claimed: true,
          updatedAt: new Date()
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
    console.error('Error claiming achievement:', error)
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
        const tradesCount = await db.$queryRaw`
          SELECT COUNT(*) as count FROM trades WHERE user_id = ${userId}
        `
        const countResult = tradesCount as any[]
        const totalTrades = countResult[0]?.count || 0
        return totalTrades >= achievement.criteria.target

      case 'profit':
        const profitResult = await db.$queryRaw`
          SELECT COALESCE(SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END), 0) as total_profit
          FROM trades WHERE user_id = ${userId}
        `
        const profitData = profitResult as any[]
        const totalProfit = profitData[0]?.total_profit || 0
        return totalProfit >= achievement.criteria.target

      case 'win_streak':
        const winStreakResult = await db.$queryRaw`
          WITH ordered_trades AS (
            SELECT 
              profit_loss,
              CASE 
                WHEN profit_loss > 0 AND LAG(profit_loss) OVER (ORDER BY close_time DESC) > 0 
                THEN 1 
                ELSE 0 
              END as is_consecutive
            FROM trades 
            WHERE user_id = ${userId} AND profit_loss > 0
            ORDER BY close_time DESC
          )
          SELECT SUM(is_consecutive) + 1 as streak_count
          FROM ordered_trades
        `
        const streakData = winStreakResult as any[]
        const currentStreak = streakData[0]?.streak_count || 0
        return currentStreak >= achievement.criteria.target

      case 'login_streak':
        return profile.streakCount >= achievement.criteria.target

      default:
        return false
    }
  } catch (error) {
    console.error('Error validating achievement:', error)
    return false
  }
}

async function applyReward(userId: string, achievement: any) {
  try {
    switch (achievement.reward.type) {
      case 'pro_days':
        const daysToAdd = achievement.reward.value as number
        const proExpiry = await db.$queryRaw`
          SELECT pro_expiry FROM profiles WHERE id = ${userId}
        `
        const expiryData = proExpiry as any[]
        const currentExpiry = expiryData[0]?.pro_expiry

        let newExpiry: Date
        if (!currentExpiry || new Date(currentExpiry) < new Date()) {
          newExpiry = new Date()
        } else {
          newExpiry = new Date(currentExpiry)
        }

        newExpiry.setDate(newExpiry.getDate() + daysToAdd)

        await db.profile.update({
          where: { id: userId },
          data: {
            proExpiry: newExpiry,
            plan: 'PRO'
          }
        })
        break

      case 'special_feature':
        break

      case 'badge':
        break
    }
  } catch (error) {
    console.error('Error applying reward:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const profile = await db.profile.findUnique({
      where: { id: userId },
      include: {
        missionProgresses: true,
        submissions: true
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    const achievements = profile.achievements as string[] || []
    const claimedAchievements = profile.submissions
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
            const tradesCount = await db.$queryRaw`
              SELECT COUNT(*) as count FROM trades WHERE user_id = ${userId}
            `
            currentProgress = (tradesCount as any[])[0]?.count || 0
            break

          case 'profit':
            const profitResult = await db.$queryRaw`
              SELECT COALESCE(SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END), 0) as total_profit
              FROM trades WHERE user_id = ${userId}
            `
            currentProgress = (profitResult as any[])[0]?.total_profit || 0
            break

          case 'login_streak':
            currentProgress = profile.streakCount
            break

          case 'win_streak':
            const winStreakResult = await db.$queryRaw`
              WITH ordered_trades AS (
                SELECT 
                  profit_loss,
                  CASE 
                    WHEN profit_loss > 0 AND LAG(profit_loss) OVER (ORDER BY close_time DESC) > 0 
                    THEN 1 
                    ELSE 0 
                  END as is_consecutive
                FROM trades 
                WHERE user_id = ${userId} AND profit_loss > 0
                ORDER BY close_time DESC
              )
              SELECT SUM(is_consecutive) + 1 as streak_count
              FROM ordered_trades
            `
            currentProgress = (winStreakResult as any[])[0]?.streak_count || 0
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
      streakCount: profile.streakCount,
      bestStreak: profile.bestStreak
    })

  } catch (error) {
    console.error('Error fetching mission status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mission status' },
      { status: 500 }
    )
  }
}
