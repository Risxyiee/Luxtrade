import { NextRequest, NextResponse } from 'next/server'
import { ACHIEVEMENTS, getAchievementById } from '@/lib/achievements-data'
import {
  ensureProfileExists,
  getProfile,
  getUserSubmissions,
  createUserSubmission,
  getMissionProgressByKey,
  upsertMissionProgress,
  addAchievementToProfile,
  updateProfile,
} from '@/lib/supabase-db'
import { supabase } from '@/lib/supabase'

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

    // Ensure profile exists
    const profile = await ensureProfileExists(userId)
    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to create or fetch profile' },
        { status: 500 }
      )
    }

    // Get user's submissions and progress
    const submissions = await getUserSubmissions(userId)

    const existingClaim = submissions.find(
      s => s.achievement_key === missionId && s.status === 'APPROVED'
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
    const submission = await createUserSubmission({
      userId,
      achievementKey: missionId,
      proofUrl: proofUrl || undefined,
      status,
      reviewedBy: achievement.type === 'automatic' ? 'SYSTEM' : undefined,
    })

    if (!submission) {
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 }
      )
    }

    // Add achievement to profile if approved
    if (achievement.type === 'automatic' && status === 'APPROVED') {
      await addAchievementToProfile(userId, missionId)
      await applyReward(userId, achievement)
    }

    // Update mission progress
    const missionProgress = await getMissionProgressByKey(userId, missionId)

    if (missionProgress) {
      await upsertMissionProgress({
        userId,
        missionKey: missionId,
        progress: missionProgress.target,
        target: missionProgress.target,
        completed: true,
        claimed: true,
      })
    } else {
      await upsertMissionProgress({
        userId,
        missionKey: missionId,
        progress: 1,
        target: 1,
        completed: true,
        claimed: true,
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
        const tradesCount = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        const totalTrades = tradesCount.count || 0
        return totalTrades >= achievement.criteria.target

      case 'profit':
        const { data: profitData } = await supabase
          .from('trades')
          .select('profit_loss')
          .eq('user_id', userId)
          .gt('profit_loss', 0)

        const totalProfit = (profitData || []).reduce((sum, t) => sum + (t.profit_loss || 0), 0)
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
        return currentStreak >= achievement.criteria.target

      case 'login_streak':
        return profile.streak_count >= achievement.criteria.target

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
        const profile = await getProfile(userId)

        if (!profile) {
          console.error('Profile not found when applying reward')
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

        // Also update Supabase Auth metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            is_pro: true,
            subscription_status: 'active',
            subscription_until: newExpiry.toISOString(),
          }
        })

        if (updateError) {
          console.error('Error updating user metadata:', updateError)
        }

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

    const profile = await ensureProfileExists(userId)

    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to create or fetch profile' },
        { status: 500 }
      )
    }

    const submissions = await getUserSubmissions(userId)
    const achievements = (profile.achievements as string[]) || []
    const claimedAchievements = submissions
      .filter(s => s.status === 'APPROVED')
      .map(s => s.achievement_key)

    const progressData = await Promise.all(
      ACHIEVEMENTS.map(async (achievement) => {
        let currentProgress = 0
        const target = achievement.criteria.target
        const isCompleted = achievements.includes(achievement.id) || claimedAchievements.includes(achievement.id)
        const isClaimed = claimedAchievements.includes(achievement.id)

        switch (achievement.criteria.type) {
          case 'trade_count':
            const tradesCount = await supabase
              .from('trades')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)

            currentProgress = tradesCount.count || 0
            break

          case 'profit':
            const { data: profitData } = await supabase
              .from('trades')
              .select('profit_loss')
              .eq('user_id', userId)
              .gt('profit_loss', 0)

            currentProgress = (profitData || []).reduce((sum, t) => sum + (t.profit_loss || 0), 0)
            break

          case 'login_streak':
            currentProgress = profile.streak_count || 0
            break

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
      streakCount: profile.streak_count || 0,
      bestStreak: profile.best_streak || 0
    })

  } catch (error) {
    console.error('Error fetching mission status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mission status' },
      { status: 500 }
    )
  }
}
