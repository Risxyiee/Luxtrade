import { NextRequest, NextResponse } from 'next/server'
import { getAchievementById } from '@/lib/achievements-data'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

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

    // For now, just return success without database operations
    // TODO: Implement proper Supabase-based achievement tracking
    console.log('⚠️ Achievement claim (temporarily disabled DB):', { userId, missionId })

    if (achievement.type !== 'automatic' && !proofUrl) {
      return NextResponse.json(
        { error: 'Proof URL is required for manual achievements' },
        { status: 400 }
      )
    }

    const status = achievement.type === 'automatic' ? 'APPROVED' : 'PENDING'

    return NextResponse.json({
      success: true,
      message: achievement.type === 'automatic'
        ? `Achievement "${achievement.title}" claimed! (Note: Achievement system is being updated)`
        : `Achievement "${achievement.title}" submitted for review (Note: Achievement system is being updated)`,
      achievement,
      rewardApplied: false,
      status,
      note: 'Achievement system is temporarily using limited functionality while we update the database system.'
    })

  } catch (error) {
    console.error('Error claiming achievement:', error)
    return NextResponse.json(
      { error: 'Failed to claim achievement' },
      { status: 500 }
    )
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

    // For now, return empty achievement data
    // TODO: Implement proper Supabase-based achievement tracking
    console.log('⚠️ Achievement status fetch (temporarily disabled DB):', { userId })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId)

    return NextResponse.json({
      achievements: [],
      totalCompleted: 0,
      totalClaimed: 0,
      streakCount: user?.user?.user_metadata?.streak_count || 0,
      bestStreak: user?.user?.user_metadata?.best_streak || 0,
      note: 'Achievement system is temporarily using limited functionality while we update the database system.'
    })

  } catch (error) {
    console.error('Error fetching mission status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mission status' },
      { status: 500 }
    )
  }
}
