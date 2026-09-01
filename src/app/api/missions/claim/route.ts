import { NextRequest, NextResponse } from 'next/server'
import { ACHIEVEMENTS, getAchievementById } from '@/lib/achievements-data'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
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

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Ensure profile exists
    const { data: profile } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle()

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Get user's submissions and achievements
    const { data: submissions } = await admin.from('user_submissions').select('*').eq('user_id', userId)

    const existingClaim = (submissions || []).find(
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
      isValid = await validateAutomaticAchievement(admin, userId, achievement, profile)
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
    const { data: submission, error: subError } = await admin.from('user_submissions').insert({
      user_id: String(userId),
      achievement_key: missionId,
      proof_url: proofUrl || null,
      status,
      reviewed_by: achievement.type === 'automatic' ? 'SYSTEM' : null,
    }).select().single()

    if (subError || !submission) {
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 }
      )
    }

    // Add achievement to profile and apply reward if approved
    if (achievement.type === 'automatic' && status === 'APPROVED') {
      const achievements = (profile.achievements as string[]) || []
      await admin.from('profiles').update({
        achievements: [...achievements, missionId]
      }).eq('id', userId)
      await applyReward(admin, userId, achievement)
    }

    // Update or create mission progress
    const { data: missionProgress } = await admin.from('mission_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_key', missionId)
      .maybeSingle()

    if (missionProgress) {
      await admin.from('mission_progress').update({
        progress: missionProgress.target,
        completed: true,
        claimed: true,
      }).eq('id', missionProgress.id)
    } else {
      await admin.from('mission_progress').insert({
        user_id: userId,
        mission_key: missionId,
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
    console.error('[missions/claim] Error:', error)
    return NextResponse.json(
      { error: 'Failed to claim achievement' },
      { status: 500 }
    )
  }
}

async function validateAutomaticAchievement(
  admin: ReturnType<typeof getSupabaseAdmin> & NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  achievement: any,
  profile: any
): Promise<boolean> {
  try {
    switch (achievement.criteria.type) {
      case 'trade_count': {
        const { count } = await admin.from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        const totalTrades = count || 0
        console.log(`[Achievement Validator] Trade count: ${totalTrades}, Target: ${achievement.criteria.target}`)
        return totalTrades >= achievement.criteria.target
      }

      case 'profit': {
        const { data: trades } = await admin.from('trades')
          .select('profit_loss')
          .eq('user_id', userId)
          .gt('profit_loss', 0)

        const totalProfit = (trades || []).reduce((sum: number, t: any) => sum + (Number(t.profit_loss) || 0), 0)
        console.log(`[Achievement Validator] Total profit: $${totalProfit}, Target: $${achievement.criteria.target}`)
        return totalProfit >= achievement.criteria.target
      }

      case 'win_streak': {
        const { data: winTrades } = await admin.from('trades')
          .select('profit_loss, close_time')
          .eq('user_id', userId)
          .gt('profit_loss', 0)
          .order('close_time', { ascending: false })

        let currentStreak = 0
        if (winTrades && winTrades.length > 0) {
          currentStreak = winTrades.length
        }
        console.log(`[Achievement Validator] Win streak: ${currentStreak}, Target: ${achievement.criteria.target}`)
        return currentStreak >= achievement.criteria.target
      }

      case 'login_streak': {
        const streakCount = profile.streak_count || 0
        console.log(`[Achievement Validator] Login streak: ${streakCount}, Target: ${achievement.criteria.target}`)
        return streakCount >= achievement.criteria.target
      }

      default:
        return false
    }
  } catch (error) {
    console.error('[Achievement Validator] Error validating achievement:', error)
    return false
  }
}

async function applyReward(
  admin: ReturnType<typeof getSupabaseAdmin> & NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  achievement: any
) {
  try {
    switch (achievement.reward.type) {
      case 'pro_days': {
        const daysToAdd = achievement.reward.value as number
        const { data: profile } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle()

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

        await admin.from('profiles').update({
          subscription_until: newExpiry.toISOString(),
          plan: 'PRO',
          is_pro: true,
        }).eq('id', userId)

        console.log(`[Achievement Reward] Applied ${daysToAdd} days PRO to user ${userId}`)
        break
      }

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

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { data: profile } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle()

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const { data: submissions } = await admin.from('user_submissions').select('*').eq('user_id', userId)

    const achievements = (profile.achievements as string[]) || []
    const claimedAchievements = (submissions || [])
      .filter((s: any) => s.status === 'APPROVED')
      .map((s: any) => s.achievement_key)

    const progressData = await Promise.all(
      ACHIEVEMENTS.map(async (achievement) => {
        let currentProgress = 0
        const target = achievement.criteria.target
        const isCompleted = achievements.includes(achievement.id) || claimedAchievements.includes(achievement.id)
        const isClaimed = claimedAchievements.includes(achievement.id)

        switch (achievement.criteria.type) {
          case 'trade_count': {
            const { count } = await admin.from('trades')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
            currentProgress = count || 0
            break
          }

          case 'profit': {
            const { data: trades } = await admin.from('trades')
              .select('profit_loss')
              .eq('user_id', userId)
              .gt('profit_loss', 0)
            currentProgress = (trades || []).reduce((sum: number, t: any) => sum + (Number(t.profit_loss) || 0), 0)
            break
          }

          case 'login_streak':
            currentProgress = profile.streak_count || 0
            break

          case 'win_streak': {
            const { data: winTrades } = await admin.from('trades')
              .select('profit_loss, close_time')
              .eq('user_id', userId)
              .gt('profit_loss', 0)
              .order('close_time', { ascending: false })
            let currentStreak = 0
            if (winTrades && winTrades.length > 0) {
              currentStreak = winTrades.length
            }
            currentProgress = currentStreak
            break
          }

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
    console.error('[missions/claim GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mission status' },
      { status: 500 }
    )
  }
}