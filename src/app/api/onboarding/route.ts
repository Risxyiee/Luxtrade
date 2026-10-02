import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// Force dynamic for Cloudflare Workers
export const dynamic = 'force-dynamic'

// GET: check onboarding status (also considers onboarding_steps)
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  const response = authResult.response
  const user = authResult.user
  if (response) return response
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    // No admin client — check localStorage client-side instead
    return NextResponse.json({ completed: false, source: 'no-admin' })
  }

  try {
    const { data: profile, error } = await admin.from('profiles')
      .select('onboarding_completed, onboarding_steps')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('[onboarding GET] Error fetching profile:', error)
      return NextResponse.json({ completed: false })
    }

    // Check both the boolean flag and the steps array
    const stepsCompleted = Array.isArray(profile?.onboarding_steps) ? profile.onboarding_steps : []
    const isCompleted = profile?.onboarding_completed === true || stepsCompleted.length >= 10

    return NextResponse.json({
      completed: isCompleted,
      stepsCount: stepsCompleted.length,
    })
  } catch (err) {
    console.warn('[onboarding GET] Error:', err)
    return NextResponse.json({ completed: false })
  }
}

// POST: mark onboarding as completed
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  const response = authResult.response
  const user = authResult.user
  if (response) return response
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ completed: true, persisted: false })
  }

  try {
    const { error } = await admin.from('profiles').update({
      onboarding_completed: true,
    }).eq('id', user.id)

    if (error) {
      console.error('[onboarding POST] Error updating profile:', error)
      return NextResponse.json({ completed: true, persisted: false })
    }

    return NextResponse.json({ completed: true, persisted: true })
  } catch (err) {
    console.error('[onboarding POST] Error:', err)
    return NextResponse.json({ completed: true, persisted: false })
  }
}
