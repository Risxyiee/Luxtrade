import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// GET: Get current user's public profile status
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ publicProfile: false })
  }

  try {
    const { data: profile } = await admin.from('profiles')
      .select('public_profile')
      .eq('id', user.id)
      .maybeSingle()

    const isPublic = profile?.public_profile ?? false
    return NextResponse.json({ publicProfile: isPublic })
  } catch (err: any) {
    console.error('[Public Profile GET] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch profile status' }, { status: 500 })
  }
}

// PUT: Toggle public profile on/off
export async function PUT(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { publicProfile } = body

    if (typeof publicProfile !== 'boolean') {
      return NextResponse.json({ error: 'publicProfile must be a boolean' }, { status: 400 })
    }

    await admin.from('profiles').update({
      public_profile: publicProfile,
    }).eq('id', user.id)

    return NextResponse.json({ publicProfile })
  } catch (err: any) {
    console.error('[Public Profile PUT] Error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
