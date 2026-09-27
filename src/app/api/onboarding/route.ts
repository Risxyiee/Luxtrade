import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// GET: check onboarding status
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
    return NextResponse.json({ completed: true })
  }

  try {
    const { data: profile } = await admin.from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()
    return NextResponse.json({ completed: profile?.onboarding_completed ?? false })
  } catch {
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
    return NextResponse.json({ completed: true })
  }

  try {
    await admin.from('profiles').update({
      onboarding_completed: true,
    }).eq('id', user.id)
    return NextResponse.json({ completed: true })
  } catch {
    return NextResponse.json({ completed: true })
  }
}