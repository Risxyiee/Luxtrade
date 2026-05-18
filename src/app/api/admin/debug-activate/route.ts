import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    console.log('🔍 [DEBUG ACTIVATE] Starting debug...')
    console.log('🔍 [DEBUG ACTIVATE] userId:', userId)

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get service role key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not found' }, { status: 500 })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    console.log('✅ [DEBUG ACTIVATE] Admin client created')

    // Step 1: Get user
    console.log('📥 [DEBUG ACTIVATE] Step 1: Fetching user...')
    const { data: { user }, error: fetchError } = await adminClient.auth.admin.getUserById(userId)

    if (fetchError) {
      console.error('❌ [DEBUG ACTIVATE] Fetch error:', fetchError)
      return NextResponse.json({
        step: 'fetch_user',
        error: fetchError.message,
        details: JSON.stringify(fetchError, null, 2)
      }, { status: 500 })
    }

    if (!user) {
      console.error('❌ [DEBUG ACTIVATE] User not found')
      return NextResponse.json({
        step: 'fetch_user',
        error: 'User not found'
      }, { status: 404 })
    }

    console.log('✅ [DEBUG ACTIVATE] User found:', user.email)
    console.log('📊 [DEBUG ACTIVATE] Current metadata:', JSON.stringify(user.user_metadata, null, 2))

    // Step 2: Prepare new metadata
    console.log('📝 [DEBUG ACTIVATE] Step 2: Preparing new metadata...')
    const newIsPro = true
    const now = new Date()
    const subscriptionUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const newMetadata = {
      is_pro: newIsPro,
      subscription_status: 'active',
      subscription_until: subscriptionUntil,
      has_ever_been_pro: true,
      updated_at: now.toISOString()
    }

    console.log('📝 [DEBUG ACTIVATE] New metadata:', JSON.stringify(newMetadata, null, 2))

    // Step 3: Update user
    console.log('💾 [DEBUG ACTIVATE] Step 3: Updating user metadata...')
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    })

    if (updateError) {
      console.error('❌ [DEBUG ACTIVATE] Update error:', updateError)
      return NextResponse.json({
        step: 'update_user',
        error: updateError.message,
        details: JSON.stringify(updateError, null, 2),
        metadataAttempted: newMetadata
      }, { status: 500 })
    }

    console.log('✅ [DEBUG ACTIVATE] Update successful!')
    console.log('📊 [DEBUG ACTIVATE] Updated metadata:', JSON.stringify(updatedUser.user?.user_metadata, null, 2))

    return NextResponse.json({
      success: true,
      message: 'PRO activated successfully',
      before: {
        is_pro: user.user_metadata?.is_pro,
        metadata: user.user_metadata
      },
      after: {
        is_pro: updatedUser.user?.user_metadata?.is_pro,
        metadata: updatedUser.user?.user_metadata
      }
    })
  } catch (error: any) {
    console.error('❌ [DEBUG ACTIVATE] Exception:', error)
    return NextResponse.json({
      step: 'exception',
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
