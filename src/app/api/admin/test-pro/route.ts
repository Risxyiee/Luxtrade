import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    console.log('🧪 [TEST PRO] Starting test...')
    console.log('🧪 [TEST PRO] userId:', userId)
    console.log('🧪 [TEST PRO] supabaseAdmin available:', !!supabaseAdmin)
    console.log('🧪 [TEST PRO] SERVICE_ROLE_KEY set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    if (!supabaseAdmin) {
      console.error('❌ [TEST PRO] supabaseAdmin is null')
      return NextResponse.json({
        success: false,
        error: 'supabaseAdmin is null',
        reason: 'SUPABASE_SERVICE_ROLE_KEY is not set in environment variables'
      })
    }

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      })
    }

    // Test 1: Get user
    console.log('🧪 [TEST PRO] Test 1: Fetching user...')
    const { data: { user }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (fetchError) {
      console.error('❌ [TEST PRO] Failed to fetch user:', fetchError)
      return NextResponse.json({
        success: false,
        test: 'fetch_user',
        error: fetchError.message,
        details: fetchError
      })
    }

    if (!user) {
      console.error('❌ [TEST PRO] User not found')
      return NextResponse.json({
        success: false,
        test: 'fetch_user',
        error: 'User not found'
      })
    }

    console.log('✅ [TEST PRO] User found:', user.email)
    console.log('📊 [TEST PRO] Current is_pro:', user.user_metadata?.is_pro)
    console.log('📊 [TEST PRO] Current subscription_status:', user.user_metadata?.subscription_status)

    // Test 2: Update user metadata
    console.log('🧪 [TEST PRO] Test 2: Updating user metadata...')
    const testMetadata = {
      ...user.user_metadata,
      is_pro: !user.user_metadata?.is_pro, // Toggle
      subscription_status: !user.user_metadata?.is_pro ? 'active' : 'inactive',
      updated_at: new Date().toISOString()
    }

    console.log('📝 [TEST PRO] New metadata:', JSON.stringify(testMetadata, null, 2))

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: testMetadata
    })

    if (updateError) {
      console.error('❌ [TEST PRO] Failed to update user:', updateError)
      return NextResponse.json({
        success: false,
        test: 'update_user',
        error: updateError.message,
        details: updateError
      })
    }

    console.log('✅ [TEST PRO] User updated successfully')
    console.log('📊 [TEST PRO] New is_pro:', updatedUser.user?.user_metadata?.is_pro)

    return NextResponse.json({
      success: true,
      message: 'PRO toggle test successful',
      before: {
        is_pro: user.user_metadata?.is_pro,
        subscription_status: user.user_metadata?.subscription_status
      },
      after: {
        is_pro: updatedUser.user?.user_metadata?.is_pro,
        subscription_status: updatedUser.user?.user_metadata?.subscription_status
      }
    })
  } catch (error: any) {
    console.error('❌ [TEST PRO] Exception:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
