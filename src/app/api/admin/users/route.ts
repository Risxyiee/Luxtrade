import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAdminStatus } from '@/lib/supabase-admin-alt'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'

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
      await db.profile.create({ data: { id: userId, ...data } })
    }
    console.log(`✅ [ADMIN API] Synced Prisma profile for ${userId}: is_pro=${isPro}`)
  } catch (err) {
    console.warn('⚠️ [ADMIN API] Failed to sync Prisma profile (non-critical):', err)
  }
}

// GET all users — Prisma profiles PRIMARY (no user lost), Supabase Auth for enrichment only
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ADMIN API] Fetching users...')
    console.log('📊 [ADMIN API] DB available:', isDatabaseAvailable())
    console.log('📊 [ADMIN API] Supabase Admin:', JSON.stringify(getAdminStatus()))

    // ── Step 1: Fetch ALL profiles from Prisma DB (PRIMARY source of truth) ──
    let profiles: any[] = []

    if (isDatabaseAvailable()) {
      try {
        await ensureSchema()

        // Try Prisma ORM first
        try {
          profiles = await db.profile.findMany({ orderBy: { createdAt: 'desc' } })
          console.log(`✅ [ADMIN API] Prisma findMany: ${profiles.length} profiles`)
        } catch (_prismaErr) {
          // ORM failed (missing column?) — fallback to raw SQL
          console.warn('⚠️ [ADMIN API] Prisma findMany failed, trying raw SQL...')
          try {
            const raw = await db.$queryRaw`SELECT * FROM profiles ORDER BY created_at DESC`
            if (Array.isArray(raw) && raw.length > 0) {
              profiles = raw
              console.log(`✅ [ADMIN API] Raw SQL: ${profiles.length} profiles`)
            }
          } catch (_rawErr) {
            console.warn('⚠️ [ADMIN API] Raw SQL also failed')
          }
        }
      } catch (dbErr: any) {
        console.error('❌ [ADMIN API] DB error:', dbErr?.message?.substring(0, 200))
      }
    }

    // ── Step 2: Fetch Supabase Auth for enrichment (non-critical) ──
    let authUserMap = new Map<string, any>()
    let authEnriched = false

    if (supabaseAdmin) {
      try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
        if (!error && users) {
          authUserMap = new Map(users.map(u => [u.id, u]))
          authEnriched = true
          console.log(`✅ [ADMIN API] Supabase Auth: ${users.length} users for enrichment`)
        } else if (error) {
          console.warn('⚠️ [ADMIN API] Auth error (non-critical):', error.message)
        }
      } catch (err) {
        console.warn('⚠️ [ADMIN API] Auth call failed (non-critical):', err)
      }
    }

    // ── Step 3: Build user list from Prisma profiles, enriched with Auth ──
    const profileIds = new Set(profiles.map((p: any) => p.id))

    const formattedUsers = profiles.map(profile => {
      const authUser = authUserMap.get(profile.id)
      const metadata = authUser?.user_metadata || {}

      const isPro = profile.is_pro ?? metadata.is_pro ?? false
      const plan = profile.plan ?? (isPro ? 'PRO' : 'FREE')

      return {
        id: profile.id,
        email: profile.email || authUser?.email || metadata.email || '-',
        full_name: profile.full_name || metadata.full_name || metadata.name || 'No Name',
        display_name: metadata.display_name || null,
        plan,
        subscription_status: isPro ? 'active' : 'inactive',
        is_pro: isPro,
        subscription_until: profile.subscription_until?.toISOString() ?? profile.proExpiry?.toISOString() ?? metadata.subscription_until ?? null,
        my_referral_code: profile.myReferralCode || metadata.my_referral_code || null,
        referred_by_code: profile.referredByCode || metadata.referred_by_code || null,
        referred_by: metadata.referred_by || null,
        has_duplicate_device: metadata.has_duplicate_device || false,
        referral_status: metadata.referral_status || null,
        commission_paid: profile.commissionPaid ?? metadata.commission_paid ?? false,
        has_ever_been_pro: isPro ? true : (profile.hasEverBeenPro ?? metadata.has_ever_been_pro ?? false),
        device_id: profile.deviceId || metadata.device_id || null,
        created_at: profile.createdAt?.toISOString() || authUser?.created_at || new Date().toISOString(),
        role: profile.role || metadata.role || 'member',
        emailVerified: profile.emailVerified ?? (authUser?.email_confirmed_at != null) ?? false,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        has_auth: !!authUser,
      }
    })

    // ── Step 4: Append Auth-only users (in Auth but NOT in Prisma) so nobody is lost ──
    const authOnlyUsers = Array.from(authUserMap.values())
      .filter((u: any) => !profileIds.has(u.id))
      .map((user: any) => {
        const metadata = user.user_metadata || {}
        return {
          id: user.id,
          email: user.email || '-',
          full_name: metadata.full_name || metadata.name || 'No Name',
          display_name: metadata.display_name || null,
          plan: metadata.is_pro ? 'PRO' : 'FREE',
          subscription_status: metadata.is_pro ? 'active' : 'inactive',
          is_pro: metadata.is_pro ?? false,
          subscription_until: metadata.subscription_until ?? null,
          my_referral_code: metadata.my_referral_code || null,
          referred_by_code: metadata.referred_by_code || null,
          referred_by: metadata.referred_by || null,
          has_duplicate_device: metadata.has_duplicate_device || false,
          referral_status: metadata.referral_status || null,
          commission_paid: metadata.commission_paid ?? false,
          has_ever_been_pro: metadata.has_ever_been_pro ?? false,
          device_id: metadata.device_id || null,
          created_at: user.created_at || new Date().toISOString(),
          role: metadata.role || 'member',
          emailVerified: user.email_confirmed_at != null,
          last_sign_in_at: user.last_sign_in_at || null,
          has_auth: true,
        }
      })

    const allUsers = [...formattedUsers, ...authOnlyUsers]

    console.log(`✅ [ADMIN API] Total: ${allUsers.length} users (${formattedUsers.length} DB + ${authOnlyUsers.length} Auth-only)`)

    return NextResponse.json({
      users: allUsers,
      count: allUsers.length,
      source: authEnriched ? 'prisma+auth' : 'prisma-only',
      profile_count: profiles.length,
      auth_count: authUserMap.size,
      auth_only_count: authOnlyUsers.length,
      ...(authOnlyUsers.length > 0
        ? { notice: `${authOnlyUsers.length} user ada di Auth tapi belum punya profile di database.` }
        : {}),
    })
  } catch (error) {
    console.error('❌ [ADMIN API] UNEXPECTED ERROR:', error)
    return NextResponse.json(
      {
        error: 'Gagal memuat data user',
        details: error instanceof Error ? error.message : String(error)
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
          details: 'SUPABASE_SERVICE_ROLE_KEY is missing'
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