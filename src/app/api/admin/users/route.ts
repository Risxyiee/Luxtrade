import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAdminStatus } from '@/lib/supabase-admin-alt'
import { db } from '@/lib/db'

// Helper: sync subscription data to Prisma profile
async function syncProfileFromAuth(userId: string, isPro: boolean, subscriptionUntil: string | null) {
  try {
    const existingProfile = await db.profile.findUnique({ where: { id: userId } })
    const data: any = {
      plan: isPro ? 'PRO' : 'FREE',
      is_pro: isPro,
      subscription_until: subscriptionUntil ? new Date(subscriptionUntil) : null,
      proExpiry: subscriptionUntil ? new Date(subscriptionUntil) : null,
    }
    if (existingProfile) {
      await db.profile.update({ where: { id: userId }, data })
    } else {
      // Create profile if it doesn't exist (e.g., new user from admin panel)
      await db.profile.create({ data: { id: userId, ...data } })
    }
    console.log(`✅ [ADMIN API] Synced Prisma profile for ${userId}: is_pro=${isPro}`)
  } catch (err) {
    console.warn('⚠️ [ADMIN API] Failed to sync Prisma profile (non-critical):', err)
  }
}

// GET all users from Supabase Auth, merged with Prisma profiles (profiles = source of truth)
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ADMIN API] Fetching users from Supabase Auth...')
    console.log('📊 [ADMIN API] Admin status:', JSON.stringify(getAdminStatus()))

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      const status = getAdminStatus()
      console.error('❌ [ADMIN API] supabaseAdmin is not configured')
      console.error('❌ [ADMIN API] Status:', JSON.stringify(status))
      return NextResponse.json(
        {
          error: 'Admin configuration error',
          details: 'SUPABASE_SERVICE_ROLE_KEY is not configured. Please set it in environment variables.',
          debug: status
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

    // Fetch ALL profiles from Prisma (source of truth for is_pro, plan, subscription)
    const profiles = await db.profile.findMany({})
    const profileMap = new Map(profiles.map(p => [p.id, p]))
    console.log(`✅ [ADMIN API] Found ${profiles.length} profiles in Prisma`)

    // Format users - Prisma profile data overrides Auth metadata for subscription fields
    const formattedUsers = (users || []).map(user => {
      const metadata = user.user_metadata || {}
      const createdAt = user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString()

      // Prisma profile is the source of truth for subscription data
      const profile = profileMap.get(user.id)
      const isPro = profile?.is_pro ?? metadata.is_pro ?? false
      const plan = profile?.plan ?? (isPro ? 'PRO' : 'FREE')
      const subUntil = profile?.subscription_until?.toISOString() ?? metadata.subscription_until ?? null
      const subStatus = isPro ? 'active' : 'inactive'

      return {
        id: user.id,
        email: user.email || profile?.email || '-',
        full_name: profile?.full_name || metadata.full_name || metadata.name || 'No Name',
        display_name: metadata.display_name || null,
        plan,
        subscription_status: subStatus,
        is_pro: isPro,
        subscription_until: subUntil,
        my_referral_code: metadata.my_referral_code || null,
        referred_by_code: metadata.referred_by_code || null,
        referred_by: metadata.referred_by || null,
        has_duplicate_device: metadata.has_duplicate_device || false,
        referral_status: metadata.referral_status || null,
        commission_paid: metadata.commission_paid || false,
        has_ever_been_pro: isPro ? true : (metadata.has_ever_been_pro || false),
        device_id: metadata.device_id || null,
        created_at: createdAt,
        role: profile?.role || metadata.role || 'member',
      }
    })

    console.log(`✅ [ADMIN API] Returning ${formattedUsers.length} formatted users (merged with Prisma profiles)`)

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
    const { userId, action = 'activate', days = 30 } = body

    console.log('🔧 [ADMIN API] PATCH request')
    console.log('🔧 [ADMIN API] action:', action)
    console.log('🔧 [ADMIN API] userId:', userId)
    console.log('🔧 [ADMIN API] days:', days)
    console.log('📊 [ADMIN API] Admin status:', JSON.stringify(getAdminStatus()))

    if (!supabaseAdmin) {
      const status = getAdminStatus()
      console.error('❌ [ADMIN API] supabaseAdmin is not configured')
      console.error('❌ [ADMIN API] Status:', JSON.stringify(status))
      return NextResponse.json(
        {
          error: 'Admin configuration error',
          details: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables. Please add it in Vercel dashboard.',
          debug: status,
          solution: 'Go to Vercel Project Settings > Environment Variables > Add SUPABASE_SERVICE_ROLE_KEY'
        },
        { status: 500 }
      )
    }

    if (!userId) {
      console.error('❌ [ADMIN API] User ID is required')
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get current user metadata
    console.log('🔍 [ADMIN API] Fetching user by ID:', userId)
    const { data: { user }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (fetchError) {
      console.error('❌ [ADMIN API] Error fetching user:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch user', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!user) {
      console.error('❌ [ADMIN API] User not found:', userId)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    console.log('✅ [ADMIN API] User found:', user.email)
    console.log('📊 [ADMIN API] Current metadata:', JSON.stringify(user.user_metadata, null, 2))

    // Handle different actions
    if (action === 'revoke') {
      // Revoke PRO
      const newMetadata = {
        ...user.user_metadata,
        is_pro: false,
        subscription_status: 'inactive',
        subscription_until: null,
        updated_at: new Date().toISOString()
      }

      console.log('📝 [ADMIN API] New metadata (revoke):', JSON.stringify(newMetadata, null, 2))

      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: newMetadata
      })

      if (updateError) {
        console.error('❌ [ADMIN API] Error updating user:', updateError)
        return NextResponse.json(
          { error: updateError.message, details: updateError },
          { status: 500 }
        )
      }

      // Also sync revoke to Prisma profile
      await syncProfileFromAuth(userId, false, null)

      console.log('✅ [ADMIN API] PRO revoked for user:', updatedUser.user?.email)

      return NextResponse.json({
        message: 'PRO status revoked successfully',
        user: updatedUser.user
      })
    } else if (action === 'activate') {
      // Activate PRO
      // Calculate new subscription date (add days to current date or extend if already PRO)
      const now = new Date()
      const currentSubscriptionUntil = user.user_metadata?.subscription_until
        ? new Date(user.user_metadata.subscription_until)
        : now

      // If subscription is still valid, extend from current expiry. If expired, start from now.
      const baseDate = currentSubscriptionUntil > now ? currentSubscriptionUntil : now
      const subscriptionUntil = new Date(baseDate.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString()

      console.log('📅 [ADMIN API] Subscription until:', subscriptionUntil)

      // Merge existing metadata with new PRO status
      const newMetadata = {
        ...user.user_metadata,
        is_pro: true,
        subscription_status: 'active',
        subscription_until: subscriptionUntil,
        has_ever_been_pro: true,
        updated_at: new Date().toISOString()
      }

      console.log('📝 [ADMIN API] New metadata:', JSON.stringify(newMetadata, null, 2))

      // Update user metadata
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: newMetadata
      })

      if (updateError) {
        console.error('❌ [ADMIN API] Error updating user:', updateError)
        return NextResponse.json(
          { error: updateError.message, details: updateError },
          { status: 500 }
        )
      }

      // Also sync to Prisma profile
      await syncProfileFromAuth(userId, true, subscriptionUntil)

      console.log('✅ [ADMIN API] PRO activated for user:', updatedUser.user?.email)

      return NextResponse.json({
        message: 'PRO activated successfully',
        user: updatedUser.user,
        subscription_until: subscriptionUntil
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "activate" or "revoke"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('❌ [ADMIN API] Error in PATCH:', error)
    console.error('❌ [ADMIN API] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// DELETE - Revoke PRO for user
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    console.log('🔧 [ADMIN API] DELETE request - Revoke PRO')
    console.log('🔧 [ADMIN API] userId:', userId)
    console.log('📊 [ADMIN API] Admin status:', JSON.stringify(getAdminStatus()))

    if (!supabaseAdmin) {
      const status = getAdminStatus()
      console.error('❌ [ADMIN API] supabaseAdmin is not configured')
      console.error('❌ [ADMIN API] Status:', JSON.stringify(status))
      return NextResponse.json(
        {
          error: 'Admin configuration error',
          details: 'SUPABASE_SERVICE_ROLE_KEY is missing',
          debug: status
        },
        { status: 500 }
      )
    }

    if (!userId) {
      console.error('❌ [ADMIN API] User ID is required')
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get current user metadata
    console.log('🔍 [ADMIN API] Fetching user by ID:', userId)
    const { data: { user }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (fetchError) {
      console.error('❌ [ADMIN API] Error fetching user:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch user', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!user) {
      console.error('❌ [ADMIN API] User not found:', userId)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    console.log('✅ [ADMIN API] User found:', user.email)
    console.log('📊 [ADMIN API] Current metadata:', JSON.stringify(user.user_metadata, null, 2))

    // Update user metadata to revoke PRO
    const newMetadata = {
      ...user.user_metadata,
      is_pro: false,
      subscription_status: 'inactive',
      subscription_until: null,
      updated_at: new Date().toISOString()
    }

    console.log('📝 [ADMIN API] New metadata (revoke):', JSON.stringify(newMetadata, null, 2))

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    })

    if (updateError) {
      console.error('❌ [ADMIN API] Error updating user:', updateError)
      return NextResponse.json(
        { error: updateError.message, details: updateError },
        { status: 500 }
      )
    }

    // Also sync revoke to Prisma profile
    await syncProfileFromAuth(userId, false, null)

    console.log('✅ [ADMIN API] PRO revoked for user:', updatedUser.user?.email)

    return NextResponse.json({
      message: 'PRO status revoked successfully',
      user: updatedUser.user
    })
  } catch (error) {
    console.error('❌ [ADMIN API] Error revoking PRO:', error)
    console.error('❌ [ADMIN API] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      {
        error: 'Failed to revoke PRO',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
