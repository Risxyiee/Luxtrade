import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    console.log('🧪 [TEST ACTIVATION] Testing activation endpoint')
    console.log('🧪 [TEST ACTIVATION] supabaseAdmin available:', !!supabaseAdmin)

    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is not configured',
        status: 'FAILED',
        fix: 'Add SUPABASE_SERVICE_ROLE_KEY to environment variables'
      }, { status: 500 })
    }

    if (!userId) {
      return NextResponse.json({
        error: 'userId parameter is required',
        usage: '/api/admin/test-activation?userId=YOUR_USER_ID'
      }, { status: 400 })
    }

    // Test 1: Fetch user
    console.log('🔍 [TEST] Fetching user:', userId)
    const { data: { user }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (fetchError) {
      return NextResponse.json({
        error: 'Failed to fetch user',
        details: fetchError.message,
        status: 'FAILED'
      }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({
        error: 'User not found',
        userId,
        status: 'FAILED'
      }, { status: 404 })
    }

    console.log('✅ [TEST] User found:', user.email)

    // Test 2: Try to update user metadata
    console.log('📝 [TEST] Attempting to update user metadata...')
    const now = new Date()
    const subscriptionUntil = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString()

    const newMetadata = {
      ...user.user_metadata,
      is_pro: true,
      subscription_status: 'active',
      subscription_until: subscriptionUntil,
      has_ever_been_pro: true,
      updated_at: now.toISOString()
    }

    console.log('📝 [TEST] New metadata:', JSON.stringify(newMetadata, null, 2))

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    })

    if (updateError) {
      console.error('❌ [TEST] Update failed:', updateError)
      return NextResponse.json({
        error: 'Failed to update user',
        details: updateError.message,
        fullError: updateError,
        status: 'FAILED'
      }, { status: 500 })
    }

    console.log('✅ [TEST] Update successful!')
    console.log('✅ [TEST] Updated user metadata:', JSON.stringify(updatedUser.user?.user_metadata, null, 2))

    return NextResponse.json({
      status: 'SUCCESS',
      message: 'PRO activated successfully',
      userId,
      email: user.email,
      subscriptionUntil,
      oldMetadata: user.user_metadata,
      newMetadata: updatedUser.user?.user_metadata
    })

  } catch (error) {
    console.error('❌ [TEST ACTIVATION] Error:', error)
    return NextResponse.json({
      error: 'Test activation failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      status: 'FAILED'
    }, { status: 500 })
  }
}
