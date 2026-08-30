export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'

// GET - Sync current user profile (ensure profile exists)
export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    const email = user.email

    // Check or create profile
    let profile = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!profile) {
      console.log('📝 Creating profile for user:', userId)
      profile = await db.profile.create({
        data: {
          id: userId,
          email: email || null,
          plan: 'FREE',
          is_pro: false,
          role: 'USER',
          streakCount: 0,
          bestStreak: 0,
          achievements: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
      console.log('✅ Profile created for user:', userId)
    } else if (email && profile.email !== email) {
      // Update email if changed
      profile = await db.profile.update({
        where: { id: userId },
        data: { email, updatedAt: new Date() }
      })
      console.log('✅ Profile email updated for user:', userId)
    }

    // Count user trades
    const tradeCount = await db.trade.count({
      where: { user_id: userId }
    })

    return NextResponse.json({
      success: true,
      profile,
      stats: {
        tradeCount
      }
    })
  } catch (error) {
    console.error('Sync profile error:', error)
    return NextResponse.json(
      { error: 'Failed to sync profile' },
      { status: 500 }
    )
  }
}
