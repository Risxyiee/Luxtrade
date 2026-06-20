import { NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use Prisma to bypass RLS and fetch profile
    const profile = await db.profile.findUnique({
      where: { id: user.id }
    })

    if (!profile) {
      return NextResponse.json({ profile: null })
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        plan: profile.plan,
        is_pro: profile.is_pro,
        subscription_until: profile.subscription_until?.toISOString() ?? null,
        proExpiry: profile.proExpiry?.toISOString() ?? null,
        role: profile.role,
        achievements: profile.achievements,
        streakCount: profile.streakCount,
        bestStreak: profile.bestStreak,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
