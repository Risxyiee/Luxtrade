import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// Force dynamic for Cloudflare Workers
export const dynamic = 'force-dynamic'

// GET: fetch onboarding step progress for the authenticated user
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
    return NextResponse.json({ steps: [] })
  }

  try {
    // Try to read progress from profiles.onboarding_steps (JSON array)
    const { data: profile, error } = await admin.from('profiles')
      .select('onboarding_steps')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('[onboarding/progress GET] Error fetching profile:', error)
      return NextResponse.json({ steps: [] })
    }

    // onboarding_steps is a JSON column storing string[] of completed step IDs
    const steps = Array.isArray(profile?.onboarding_steps) ? profile.onboarding_steps : []
    return NextResponse.json({ steps })
  } catch (err) {
    console.warn('[onboarding/progress GET] Error:', err)
    return NextResponse.json({ steps: [] })
  }
}

// POST: save onboarding step progress for the authenticated user
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
    return NextResponse.json({ success: true, persisted: false })
  }

  try {
    const body = await request.json()
    const { steps } = body

    if (!Array.isArray(steps)) {
      return NextResponse.json({ error: 'steps must be an array' }, { status: 400 })
    }

    // Validate all items are strings
    const validSteps = steps.filter((s: any) => typeof s === 'string')

    // Update the profile with the completed steps
    const { error: updateError } = await admin.from('profiles').update({
      onboarding_steps: validSteps,
      onboarding_completed: validSteps.length >= 10, // 10 steps = all complete
    }).eq('id', user.id)

    if (updateError) {
      console.error('[onboarding/progress POST] Error updating profile:', updateError)
      // Check if the column might not exist yet
      if (updateError.message?.includes('does not exist') || updateError.code === 'PGRST204') {
        console.warn('[onboarding/progress POST] onboarding_steps column may not exist — run migration')
        return NextResponse.json({
          success: true,
          persisted: false,
          hint: 'Column onboarding_steps missing — run SQL migration to add it'
        })
      }
      return NextResponse.json({ error: 'Failed to save progress', details: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, persisted: true })
  } catch (err) {
    console.error('[onboarding/progress POST] Error:', err)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}
