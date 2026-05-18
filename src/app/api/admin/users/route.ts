import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET all users from Supabase Auth
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ADMIN API] Fetching users from Supabase Auth...')

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('❌ [ADMIN API] supabaseAdmin is not configured. SUPABASE_SERVICE_ROLE_KEY is missing.')
      return NextResponse.json(
        {
          error: 'Admin configuration error',
          details: 'SUPABASE_SERVICE_ROLE_KEY is not configured. Please set it in environment variables.'
        },
        { status: 500 }
      )
    }

    // Get all users from Supabase Auth (requires service role)
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error('❌ [ADMIN API] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users from Supabase', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ [ADMIN API] Found ${users?.length || 0} users in Supabase Auth`)

    // Format users to match admin panel expectations
    const formattedUsers = (users || []).map(user => {
      const metadata = user.user_metadata || {}
      const createdAt = user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString()

      return {
        id: user.id,
        email: user.email || '-',
        full_name: metadata.full_name || metadata.name || 'No Name',
        display_name: metadata.display_name || null,
        subscription_status: metadata.subscription_status || 'inactive',
        is_pro: metadata.is_pro || false,
        subscription_until: metadata.subscription_until || null,
        my_referral_code: metadata.my_referral_code || null,
        referred_by_code: metadata.referred_by_code || null,
        referred_by: metadata.referred_by || null,
        has_duplicate_device: metadata.has_duplicate_device || false,
        referral_status: metadata.referral_status || null,
        commission_paid: metadata.commission_paid || false,
        has_ever_been_pro: metadata.has_ever_been_pro || false,
        device_id: metadata.device_id || null,
        created_at: createdAt,
        role: metadata.role || 'member',
      }
    })

    console.log(`✅ [ADMIN API] Returning ${formattedUsers.length} formatted users`)
    console.log('📊 [ADMIN API] First user data:', JSON.stringify(formattedUsers[0] || 'No users', null, 2))

    return NextResponse.json({ users: formattedUsers, count: formattedUsers.length })
  } catch (error) {
    console.error('❌ [ADMIN API] ERROR fetching users:', error)
    console.error('❌ [ADMIN API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      code: (error as any)?.code,
      meta: (error as any)?.meta,
    }

    console.error('❌ [ADMIN API] Error details:', JSON.stringify(errorDetails, null, 2))

    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        details: errorDetails.message,
        debug: errorDetails
      },
      { status: 500 }
    )
  }
}

// POST create a new user in Supabase
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, metadata = {} } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || Math.random().toString(36).slice(-8),
      email_confirm: true,
      user_metadata: {
        full_name: name || '',
        ...metadata
      }
    })

    if (error) {
      console.error('❌ [ADMIN API] Error creating user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.log('✅ [ADMIN API] User created:', data.user?.email)
    return NextResponse.json({ user: data.user })
  } catch (error) {
    console.error('❌ [ADMIN API] Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// PATCH - Activate PRO for user
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, days = 30 } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get current user metadata
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Calculate new subscription date
    const now = new Date()
    const subscriptionUntil = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString()

    // Update user metadata
    const { data: updatedUser, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...user.user_metadata,
        is_pro: true,
        subscription_status: 'active',
        subscription_until: subscriptionUntil,
        has_ever_been_pro: true
      }
    })

    if (error) {
      console.error('❌ [ADMIN API] Error updating user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ [ADMIN API] PRO activated for user:', updatedUser.user?.email)

    return NextResponse.json({
      message: 'PRO activated successfully',
      user: updatedUser.user,
      subscription_until: subscriptionUntil
    })
  } catch (error) {
    console.error('❌ [ADMIN API] Error activating PRO:', error)
    return NextResponse.json(
      { error: 'Failed to activate PRO' },
      { status: 500 }
    )
  }
}

// DELETE - Revoke PRO for user
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get current user metadata
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update user metadata to revoke PRO
    const { data: updatedUser, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...user.user_metadata,
        is_pro: false,
        subscription_status: 'inactive',
        subscription_until: null
      }
    })

    if (error) {
      console.error('❌ [ADMIN API] Error updating user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ [ADMIN API] PRO revoked for user:', updatedUser.user?.email)

    return NextResponse.json({
      message: 'PRO status revoked successfully',
      user: updatedUser.user
    })
  } catch (error) {
    console.error('❌ [ADMIN API] Error revoking PRO:', error)
    return NextResponse.json(
      { error: 'Failed to revoke PRO' },
      { status: 500 }
    )
  }
}
