import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Try different methods for admin access
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const altKey1 = process.env.SERVICE_ROLE_KEY
    const altKey2 = process.env.SUPABASE_ADMIN_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    let adminKey = serviceRoleKey || altKey1 || altKey2 || anonKey
    let method = serviceRoleKey ? 'SERVICE_ROLE_KEY' : altKey1 ? 'SERVICE_ROLE_KEY (alt)' : altKey2 ? 'ADMIN_KEY' : 'ANON_KEY'

    if (!adminKey) {
      return NextResponse.json({ error: 'No Supabase credentials found' }, { status: 500 })
    }

    const adminClient = createClient(supabaseUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    console.log('🔧 [SIMPLE ACTIVATE] Using method:', method)

    // Get user
    const { data: { user }, error: fetchError } = await adminClient.auth.admin.getUserById(userId)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch user: ' + fetchError.message }, { status: 500 })
    }

    if (!user)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Toggle PRO status
    const newIsPro = !user.user_metadata?.is_pro
    const subscriptionUntil = newIsPro
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null

    const newMetadata = {
      ...user.user_metadata,
      is_pro: newIsPro,
      subscription_status: newIsPro ? 'active' : 'inactive',
      subscription_until: subscriptionUntil,
      updated_at: new Date().toISOString()
    }

    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    })

    if (updateError) {
      console.error('❌ [SIMPLE ACTIVATE] Update error:', updateError)
      return NextResponse.json({
        error: 'Failed to update user: ' + updateError.message,
        details: updateError
      }, { status: 500 })
    }

    console.log('✅ [SIMPLE ACTIVATE] Success! New PRO status:', newIsPro)

    return NextResponse.json({
      success: true,
      message: `PRO ${newIsPro ? 'activated' : 'deactivated'} successfully`,
      method,
      before: {
        is_pro: user.user_metadata?.is_pro
      },
      after: {
        is_pro: updatedUser.user?.user_metadata?.is_pro,
        subscription_until: updatedUser.user?.user_metadata?.subscription_until
      }
    })
  } catch (error: any) {
    console.error('❌ [SIMPLE ACTIVATE] Exception:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
