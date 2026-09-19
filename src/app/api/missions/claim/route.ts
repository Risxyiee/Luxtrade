import { NextRequest, NextResponse } from 'next/server'
import { ACHIEVEMENTS, getAchievementById } from '@/lib/achievements-data'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthenticatedUser } from '@/lib/api-auth'

// CRITICAL: Force dynamic untuk Cloudflare Workers
// NOTE: No runtime = 'edge' - OpenNext limitation for API routes
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('[missions/claim] Starting claim request...')

    // Parse body FIRST before auth (to avoid consuming stream)
    // CRITICAL: Use text() then parse JSON to handle stream safely in Workers
    let body: any = {}
    try {
      const rawBody = await request.text()
      console.log('[missions/claim] Raw body length:', rawBody.length)
      if (!rawBody) {
        console.log('[missions/claim] Empty body received')
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        )
      }
      body = JSON.parse(rawBody)
      console.log('[missions/claim] Body parsed:', { missionId: body.missionId, hasProofUrl: !!body.proofUrl })
    } catch (err) {
      console.error('[missions/claim] Failed to parse body:', err)
      return NextResponse.json(
        { error: 'Invalid request body: Must be valid JSON' },
        { status: 400 }
      )
    }

    const { missionId, proofUrl } = body

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

    // Auth: get the REAL user from session, NOT from request body
    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user
    const authError = authResult.error
    console.log('[missions/claim] Auth result:', {
      hasUser: !!authUser,
      userId: authUser?.id,
      userEmail: authUser?.email,
      authError,
    })

    if (!authUser || !authUser.id) {
      const errorMsg = authError || 'Unauthorized: No valid user session'
      console.error('[missions/claim] Auth failed:', errorMsg)
      return NextResponse.json({ error: errorMsg }, { status: 401 })
    }

    // Use authenticated user's ID — ignore any userId from body
    const userId = authUser.id

    console.log('[missions/claim] User authenticated:', userId)

    // Safety: ensure userId is not null/undefined before any DB operation
    if (!userId) {
      console.error('[missions/claim] authUser.id is falsy:', JSON.stringify(authUser))
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      console.error('[missions/claim] Failed to get Supabase admin client')
      return NextResponse.json({ error: 'Internal server error: Database connection failed' }, { status: 500 })
    }

    // Ensure profile exists
    console.log('[missions/claim] Checking profile for user:', userId)
    const { data: profile, error: profileError } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle()

    if (profileError) {
      console.error('[missions/claim] Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Database error fetching profile' },
        { status: 500 }
      )
    }

    if (!profile) {
      console.error('[missions/claim] Profile not found for user:', userId)
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Get user's submissions and achievements
    console.log('[missions/claim] Fetching user submissions...')
    const { data: submissions, error: submissionsError } = await admin.from('user_submissions').select('*').eq('user_id', userId)

    if (submissionsError) {
      console.error('[missions/claim] Error fetching submissions:', submissionsError)
      return NextResponse.json(
        { error: 'Database error fetching submissions' },
        { status: 500 }
      )
    }

    const existingClaim = (submissions || []).find(
      s => s.achievement_key === missionId && s.status === 'APPROVED'
    )

    if (existingClaim) {
      console.log('[missions/claim] Achievement already claimed:', missionId)
      return NextResponse.json(
        { error: 'Achievement already claimed' },
        { status: 400 }
      )
    }

    let isValid = false
    let validationMessage = ''

    if (achievement.type === 'automatic') {
      console.log('[missions/claim] Validating automatic achievement...')
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
      console.log('[missions/claim] Validation failed:', validationMessage)
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

    if (subError) {
      console.error('[missions/claim] Error creating submission:', subError)
      return NextResponse.json(
        { error: 'Failed to create submission', details: subError.message },
        { status: 500 }
      )
    }

    if (!submission) {
      console.error('[missions/claim] No submission returned after insert')
      return NextResponse.json(
        { error: 'Failed to create submission: No data returned' },
        { status: 500 }
      )
    }

    console.log('[missions/claim] Submission created:', submission.id)

    // Add achievement to profile and apply reward if approved
    if (achievement.type === 'automatic' && status === 'APPROVED') {
      console.log('[missions/claim] Applying reward to profile...')
      const achievements = (profile.achievements as string[]) || []
      const { error: updateError } = await admin.from('profiles').update({
        achievements: [...achievements, missionId]
      }).eq('id', userId)

      if (updateError) {
        console.error('[missions/claim] Error updating profile achievements:', updateError)
        // Continue anyway, submission was created
      }

      await applyReward(admin, userId, achievement)
    }

    // Update or create mission progress
    console.log('[missions/claim] Updating mission progress...')
    const { data: missionProgress } = await admin.from('mission_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_key', missionId)
      .maybeSingle()

    if (missionProgress) {
      const { error: progressError } = await admin.from('mission_progress').update({
        progress: missionProgress.target,
        completed: true,
        claimed: true,
      }).eq('id', missionProgress.id)

      if (progressError) {
        console.error('[missions/claim] Error updating mission progress:', progressError)
      }
    } else {
      const { error: insertProgressError } = await admin.from('mission_progress').insert({
        user_id: userId,
        mission_key: missionId,
        progress: 1,
        target: 1,
        completed: true,
        claimed: true,
      })

      if (insertProgressError) {
        console.error('[missions/claim] Error inserting mission progress:', insertProgressError)
      }
    }

    console.log('[missions/claim] Claim successful!')

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
    console.error('[missions/claim] Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to claim achievement'
    console.error('[missions/claim] Error message:', errorMessage)
    console.error('[missions/claim] Error stack:', error instanceof Error ? error.stack : 'No stack')

    return NextResponse.json(
      { error: errorMessage, details: errorMessage },
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
    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.id

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Batch fetch all needed data in single queries
    const [profileResult, submissionsResult, tradesResult] = await Promise.all([
      admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      admin.from('user_submissions').select('*').eq('user_id', userId),
      admin.from('trades').select('profit_loss, close_time').eq('user_id', userId)
    ])

    const profile = profileResult.data
    const submissions = submissionsResult.data || []
    const trades = tradesResult.data || []

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const achievements = (profile.achievements as string[]) || []
    const claimedAchievements = submissions
      .filter((s: any) => s.status === 'APPROVED')
      .map((s: any) => s.achievement_key)

    // Pre-calculate common metrics to avoid repeated queries
    const totalTrades = trades.length
    const profitableTrades = trades.filter((t: any) => Number(t.profit_loss) > 0)
    const totalProfit = profitableTrades.reduce((sum: number, t: any) => sum + Number(t.profit_loss), 0)
    const winStreak = profitableTrades.length

    const progressData = ACHIEVEMENTS.map((achievement) => {
      let currentProgress = 0
      const target = achievement.criteria.target
      const isCompleted = achievements.includes(achievement.id) || claimedAchievements.includes(achievement.id)
      const isClaimed = claimedAchievements.includes(achievement.id)

      switch (achievement.criteria.type) {
        case 'trade_count':
          currentProgress = totalTrades
          break

        case 'profit':
          currentProgress = totalProfit
          break

        case 'login_streak':
          currentProgress = profile.streak_count || 0
          break

        case 'win_streak':
          currentProgress = winStreak
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