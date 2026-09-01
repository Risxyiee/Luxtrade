import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdminAuthFromClient, getSupabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error
    const user = authResult.user!

    const body = await request.json()
    const { userId, email, fullName } = body

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId and email are required' },
        { status: 400 }
      )
    }

    // SECURITY: Only allow syncing the authenticated user's own data
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: cannot sync another user' },
        { status: 403 }
      )
    }

    const adminClient = getSupabaseAdmin()
    if (!adminClient) {
      console.error('[sync-user] Supabase admin not available')
      return NextResponse.json({ success: true, action: 'skipped' })
    }

    const authAdmin = getSupabaseAdminAuthFromClient(adminClient)
    if (!authAdmin) {
      console.error('[sync-user] getSupabaseAdminAuthFromClient() returned null')
      return NextResponse.json({ success: true, action: 'skipped' })
    }

    // CRITICAL: Do NOT pass `email` as top-level param to updateUserById.
    // Doing so triggers an email change request in Supabase, which:
    //   1. Clears email_confirmed_at → user becomes unconfirmed
    //   2. Sends a confirmation email to the "old" address
    //   3. Blocks login with "Invalid login credentials"
    // Only update user_metadata.
    const { data: updatedData, error: updateErr } = await authAdmin.updateUserById(
      userId,
      {
        user_metadata: {
          full_name: fullName || email.split('@')[0],
          email: email,
        }
      }
    )

    if (updateErr) {
      console.error('[sync-user] Error updating user in Supabase:', updateErr)
      return NextResponse.json({ success: true, action: 'skipped' })
    }

    return NextResponse.json({
      success: true,
      action: 'synced',
      user: {
        id: updatedData.user.id,
        name: updatedData.user.user_metadata?.full_name || email.split('@')[0]
      }
    })
  } catch (error) {
    console.error('[sync-user] Error:', error)
    return NextResponse.json({ success: true, action: 'skipped' })
  }
}
