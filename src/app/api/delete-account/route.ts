import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { createClientForApi } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

// CRITICAL: Force dynamic untuk Cloudflare Workers
// NOTE: No runtime = 'edge' - OpenNext limitation for API routes
export const dynamic = 'force-dynamic'

// POST - Delete account and all user data
export async function POST(request: NextRequest) {
  try {
    console.log('[API /api/delete-account] Starting account deletion...')

    // Step 1: Parse body FIRST before auth (to avoid consuming stream)
    let body: any = {}
    try {
      body = await request.json()
      console.log('[API /api/delete-account] Body parsed:', { hasConfirmation: !!body.confirmation, hasEmail: !!body.email })
    } catch (err) {
      console.error('[API /api/delete-account] Failed to parse body:', err)
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Step 2: Authenticate user
    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user

    console.log('[API /api/delete-account] Auth result:', {
      hasUser: !!authUser,
      userId: authUser?.id,
      userEmail: authUser?.email,
      authError: authResult.error,
    })

    if (!authUser) {
      console.log('[API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const userId = authUser.id
    const userEmail = authUser.email
    const { confirmation, email } = body

    // Step 3: Validate confirmation
    if (!confirmation || confirmation !== 'DELETE') {
      console.log('[API] Invalid confirmation')
      return NextResponse.json(
        { error: 'Please type "DELETE" to confirm account deletion.' },
        { status: 400 }
      )
    }

    // Step 4: Validate email matches
    if (!email || email !== userEmail) {
      console.log('[API] Email mismatch', { providedEmail: email, userEmail })
      return NextResponse.json(
        { error: 'Email does not match. Please enter your email address correctly.' },
        { status: 400 }
      )
    }

    console.log('[API] Validation passed, starting deletion for user:', userId)

    // Step 5: Initialize admin client
    const admin = getSupabaseAdmin()
    if (!admin) {
      console.error('[API] Failed to initialize admin client')
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 4: Delete user's trades
    await admin.from('trades').delete().eq('user_id', userId)
    console.log('[API] Trades deleted')

    // Step 5: Delete user's journal entries
    await admin.from('journal_entries').delete().eq('user_id', userId)
    console.log('[API] Journals deleted')

    // Step 6: Delete user's trading accounts
    await admin.from('trading_accounts').delete().eq('user_id', userId)
    console.log('[API] Trading accounts deleted')

    // Step 7: Delete user's watchlist
    await admin.from('watchlist').delete().eq('user_id', userId)
    console.log('[API] Watchlist deleted')

    // Step 8: Delete user's mission progress
    await admin.from('mission_claims').delete().eq('user_id', userId)
    console.log('[API] Mission progress deleted')

    // Step 9: Delete user's weekly goals
    await admin.from('weekly_goals').delete().eq('user_id', userId)
    console.log('[API] Weekly goals deleted')

    // Step 10: Delete user's social links
    await admin.from('social_links').delete().eq('user_id', userId)
    console.log('[API] Social links deleted')

    // Step 11: Delete user's tags
    await admin.from('tags').delete().eq('user_id', userId)
    console.log('[API] Tags deleted')

    // Step 12: Delete user's profile
    await admin.from('profiles').delete().eq('id', userId)
    console.log('[API] Profile deleted')

    // Step 13: Delete user's session in Supabase Auth
    try {
      const result = await createClientForApi(request)
      const supabase = result.supabase
      if (supabase) {
        await (supabase.auth as any).admin.deleteUser(userId)
        console.log('[API] Supabase Auth user deleted')
      }
    } catch (authError) {
      console.error('[API] Failed to delete Supabase Auth user:', authError)
      // Don't fail the entire operation if auth deletion fails
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    })

  } catch (err) {
    console.error('[API /api/delete-account POST] Error:', err)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')

    // Handle specific errors
    if (err instanceof Error) {
      if (err.message.includes('Record not found') || err.message.includes('not found')) {
        console.log('[API] Some records already deleted, continuing...')
        return NextResponse.json({
          success: true,
          message: 'Account deleted successfully (some records were already removed)'
        })
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete account. Please try again or contact support.' },
      { status: 500 }
    )
  }
}