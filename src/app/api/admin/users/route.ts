import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { requireAdmin } from '@/lib/admin-auth'

// GET all users — Supabase Auth PRIMARY (has all 25 users), Prisma only for enrichment
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    // ── Step 1: Fetch ALL users from Supabase Auth (PRIMARY — has all 25 users) ──
    let authUsers: any[] = []
    const authAdmin = getAdminAuth()

    if (authAdmin) {
      try {
        const { data: { users }, error: listError } = await authAdmin.listUsers()
        if (!listError && users) {
          authUsers = users
        }
      } catch (err) {
        console.error('⚠️ Auth listUsers failed:', err)
      }
    }

    // ── Step 2: Build user list from Auth data (no Prisma needed) ──
    const formattedUsers = authUsers.map(user => {
      const metadata = user.user_metadata || {}
      const isPro = metadata.is_pro ?? false
      const plan = metadata.plan ?? (isPro ? 'PRO' : 'FREE')

      return {
        id: user.id,
        email: user.email || '-',
        full_name: metadata.full_name || metadata.name || 'No Name',
        display_name: metadata.display_name || null,
        plan,
        subscription_status: metadata.subscription_status ?? (isPro ? 'active' : 'inactive'),
        is_pro: isPro,
        subscription_until: metadata.subscription_until ?? null,
        my_referral_code: metadata.my_referral_code || null,
        referred_by_code: metadata.referred_by_code || null,
        referred_by: metadata.referred_by || null,
        has_duplicate_device: metadata.has_duplicate_device || false,
        referral_status: metadata.referral_status || null,
        commission_paid: metadata.commission_paid ?? false,
        has_ever_been_pro: metadata.has_ever_been_pro ?? (isPro ? true : false),
        device_id: metadata.device_id || null,
        created_at: user.created_at || new Date().toISOString(),
        role: metadata.role || 'member',
        emailVerified: user.email_confirmed_at != null,
        last_sign_in_at: user.last_sign_in_at || null,
        has_auth: true,
      }
    })

    return NextResponse.json({
      users: formattedUsers,
      count: formattedUsers.length,
      source: 'auth-primary',
      auth_count: authUsers.length,
      ...(formattedUsers.length === 0
        ? { notice: 'Tidak ada user ditemukan di Supabase Auth.' }
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
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { email, password, name, metadata = {} } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const authAdmin = getAdminAuth()
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const { data, error: createUserError } = await authAdmin.createUser({
      email,
      password: password || Math.random().toString(36).slice(-8),
      email_confirm: true,
      user_metadata: {
        full_name: name || '',
        ...metadata
      }
    })

    if (createUserError) {
      console.error('❌ [ADMIN API] Error creating user:', createUserError)
      return NextResponse.json(
        { error: createUserError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ user: data.user })
  } catch (error) {
    console.error('❌ [ADMIN API] Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// PATCH - Activate/Revoke PRO for user (uses Auth metadata, no Prisma)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { userId, action = 'activate', days = 30 } = body

    const authAdmin = getAdminAuth()
    if (!authAdmin) {
      return NextResponse.json(
        { error: 'Admin configuration error', details: 'SUPABASE_SERVICE_ROLE_KEY is missing.' },
        { status: 500 }
      )
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: fetchError } = await authAdmin.getUserById(userId)
    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'User not found', details: fetchError?.message },
        { status: 404 }
      )
    }

    if (action === 'revoke') {
      const newMetadata = {
        ...user.user_metadata,
        is_pro: false,
        subscription_status: 'inactive',
        plan: 'FREE',
        subscription_until: null,
        updated_at: new Date().toISOString()
      }

      const { data: updatedUser, error: updateError } = await authAdmin.updateUserById(userId, {
        user_metadata: newMetadata
      })

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Also sync to Supabase profiles table
      try {
        const svc = getSupabaseAdmin()
        if (svc) {
          await svc.from('profiles').update({
            plan: 'FREE',
            is_pro: false,
            subscription_status: 'inactive',
            pro_status: 'inactive',
            subscription_until: null,
            pro_expiry: null,
            updated_at: new Date().toISOString(),
          }).eq('id', userId)
        }
      } catch (syncErr) {
        console.error('⚠️ [ADMIN] Supabase profiles sync failed (non-blocking):', syncErr)
      }

      return NextResponse.json({ message: 'PRO status revoked successfully', user: updatedUser.user })
    } else if (action === 'activate') {
      const now = new Date()
      const currentSubscriptionUntil = user.user_metadata?.subscription_until
        ? new Date(user.user_metadata.subscription_until)
        : now

      const baseDate = currentSubscriptionUntil > now ? currentSubscriptionUntil : now
      const subscriptionUntil = new Date(baseDate.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString()

      const newMetadata = {
        ...user.user_metadata,
        is_pro: true,
        subscription_status: 'active',
        plan: 'PRO',
        subscription_until: subscriptionUntil,
        has_ever_been_pro: true,
        updated_at: new Date().toISOString()
      }

      const { data: updatedUser, error: updateError } = await authAdmin.updateUserById(userId, {
        user_metadata: newMetadata
      })

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Also sync to Supabase profiles table
      try {
        const svc = getSupabaseAdmin()
        if (svc) {
          await svc.from('profiles').update({
            plan: 'PRO',
            is_pro: true,
            subscription_status: 'active',
            pro_status: 'active',
            subscription_until: subscriptionUntil,
            pro_expiry: subscriptionUntil,
            has_ever_been_pro: true,
            updated_at: new Date().toISOString(),
          }).eq('id', userId)
        }
      } catch (syncErr) {
        console.error('⚠️ [ADMIN] Supabase profiles sync failed (non-blocking):', syncErr)
      }

      return NextResponse.json({
        message: 'PRO activated successfully',
        user: updatedUser.user,
        subscription_until: subscriptionUntil
      })
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "activate" or "revoke"' }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ [ADMIN API] Error in PATCH:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}