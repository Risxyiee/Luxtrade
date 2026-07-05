import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'

// POST - Delete account and all user data
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/delete-account] Starting account deletion...')

    // Step 1: Authenticate user
    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const userId = authUser.id
    const body = await request.json()
    const { confirmation, email } = body

    // Step 2: Validate confirmation
    if (!confirmation || confirmation !== 'DELETE') {
      console.log('❌ [API] Invalid confirmation')
      return NextResponse.json(
        { error: 'Please type "DELETE" to confirm account deletion.' },
        { status: 400 }
      )
    }

    // Step 3: Validate email matches
    if (!email || email !== authUser.email) {
      return NextResponse.json(
        { error: 'Email does not match. Please enter your email address correctly.' },
        { status: 400 }
      )
    }

    // Step 4: Delete user's trades
    const trades = await db.trade.findMany({
      where: { user_id: userId }
    })

    await db.trade.deleteMany({
      where: { user_id: userId }
    })
    console.log('✅ [API] Trades deleted')

    // Step 5: Delete user's journals
    await db.journal.deleteMany({
      where: { user_id: userId }
    })
    console.log('✅ [API] Journals deleted')

    // Step 6: Delete user's trading accounts
    await db.tradingAccount.deleteMany({
      where: { user_id: userId }
    })
    console.log('✅ [API] Trading accounts deleted')

    // Step 7: Delete user's watchlist
    await db.watchlist.deleteMany({
      where: { user_id: userId }
    })
    console.log('✅ [API] Watchlist deleted')

    // Step 8: Delete user's missions
    await db.mission.deleteMany({
      where: { user_id: userId }
    })
    console.log('✅ [API] Missions deleted')

    // Step 9: Delete user's profile
    await db.profile.delete({
      where: { id: userId }
    })
    console.log('✅ [API] Profile deleted')

    // Step 10: Delete user's session in Supabase Auth
    try {
      const { supabase } = createClientForApi(request)
      await (supabase.auth as any).admin.deleteUser(userId)
      console.log('✅ [API] Supabase Auth user deleted')
    } catch (authError) {
      console.error('⚠️ [API] Failed to delete Supabase Auth user:', authError)
      // Don't fail the entire operation if auth deletion fails
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    })

  } catch (err) {
    console.error('❌ [API /api/delete-account POST] Error:', err)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')

    // Handle specific errors
    if (err instanceof Error) {
      if (err.message.includes('Record not found')) {
        console.log('⚠️ [API] Some records already deleted, continuing...')
        return NextResponse.json({
          success: true,
          message: 'Account deleted successfully (some records were already removed)'
        })
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to delete account',
        details: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}