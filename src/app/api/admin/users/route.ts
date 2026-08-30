import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { requireAdmin } from '@/lib/admin-auth'

// GET all users — Auth for user list + profiles table for subscription truth
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    // ── Step 1: Fetch ALL users from Supabase Auth ──
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

    // ── Step 2: Fetch ALL profiles from Supabase profiles table (source of truth for subscription) ──
    const svc = getSupabaseAdmin()
    const profileMap = new Map<string, any>()

    if (svc) {
      try {
        const { data: profiles, error: profError } = await svc
          .from('profiles')
          .select('id, email, full_name, plan, is_pro, subscription_status, subscription_until, pro_status, pro_expiry, my_referral_code, referred_by_code, affiliate_balance, referral_count, has_ever_been_pro, device_id, referral_status, commission_paid, updated_at, created_at')

        if (!profError && profiles) {
          for (const p of profiles) {
            profileMap.set(p.id, p)
          }
          console.log(`📊 [ADMIN GET] Loaded ${profiles.length} profiles from Supabase`)
        } else if (profError) {
          console.error('⚠️ Profiles table fetch error:', profError.message)
        }
      } catch (err) {
        console.error('⚠️ Profiles table fetch failed:', err)
      }
    } else {
      console.error('⚠️ Supabase admin client not available — cannot read profiles table')
    }

    // ── Step 3: Merge Auth + Profiles (profiles table is source of truth for subscription) ──
    const formattedUsers = authUsers.map(user => {
      const metadata = user.user_metadata || {}
      const profile = profileMap.get(user.id)

      // Use profiles table data as PRIMARY for subscription fields
      // Fall back to Auth metadata ONLY if no profile exists
      const isPro = profile?.is_pro ?? metadata.is_pro ?? false
      const plan = profile?.plan ?? metadata.plan ?? (isPro ? 'PRO' : 'FREE')
      const subStatus = profile?.subscription_status ?? metadata.subscription_status ?? (isPro ? 'active' : 'inactive')
      const subUntil = profile?.subscription_until ?? metadata.subscription_until ?? null
      const hasEverBeenPro = profile?.has_ever_been_pro ?? metadata.has_ever_been_pro ?? (isPro ? true : false)

      return {
        id: user.id,
        email: user.email || profile?.email || '-',
        full_name: profile?.full_name || metadata.full_name || metadata.name || 'No Name',
        display_name: metadata.display_name || null,
        plan,
        subscription_status: subStatus,
        is_pro: isPro,
        subscription_until: subUntil,
        my_referral_code: profile?.my_referral_code ?? metadata.my_referral_code ?? null,
        referred_by_code: profile?.referred_by_code ?? metadata.referred_by_code ?? null,
        referred_by: metadata.referred_by || null,
        has_duplicate_device: metadata.has_duplicate_device || false,
        referral_status: profile?.referral_status ?? metadata.referral_status ?? null,
        commission_paid: profile?.commission_paid ?? metadata.commission_paid ?? false,
        has_ever_been_pro: hasEverBeenPro,
        device_id: profile?.device_id ?? metadata.device_id ?? null,
        created_at: user.created_at || profile?.created_at || new Date().toISOString(),
        role: metadata.role || 'member',
        emailVerified: user.email_confirmed_at != null,
        last_sign_in_at: user.last_sign_in_at || null,
        has_auth: true,
        // Diagnostic: which source was used
        _profile_found: !!profile,
      }
    })

    // ── Step 4: Include profiles that have NO Auth record (edge case) ──
    for (const [id, profile] of profileMap) {
      if (!authUsers.find(u => u.id === id)) {
        formattedUsers.push({
          id: profile.id,
          email: profile.email || '-',
          full_name: profile.full_name || 'No Name',
          display_name: null,
          plan: profile.plan || 'FREE',
          subscription_status: profile.subscription_status || 'inactive',
          is_pro: profile.is_pro || false,
          subscription_until: profile.subscription_until || null,
          my_referral_code: profile.my_referral_code || null,
          referred_by_code: profile.referred_by_code || null,
          referred_by: null,
          has_duplicate_device: false,
          referral_status: profile.referral_status || null,
          commission_paid: profile.commission_paid || false,
          has_ever_been_pro: profile.has_ever_been_pro || false,
          device_id: profile.device_id || null,
          created_at: profile.created_at || new Date().toISOString(),
          role: 'member',
          emailVerified: false,
          last_sign_in_at: null,
          has_auth: false,
          _profile_found: true,
        })
      }
    }

    const profileCount = profileMap.size

    return NextResponse.json({
      users: formattedUsers,
      count: formattedUsers.length,
      source: 'auth+profiles',
      auth_count: authUsers.length,
      profile_count: profileCount,
      ...(formattedUsers.length === 0
        ? { notice: 'Tidak ada user ditemukan.' }
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

// PATCH - Activate/Revoke PRO for user
// Updates BOTH Auth metadata AND profiles table (profiles table is source of truth)
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

    // Get Supabase admin client for profiles table
    const svc = getSupabaseAdmin()

    if (action === 'revoke') {
      console.log(`🔓 [ADMIN PATCH] Revoking PRO for user: ${userId}`) // PII redacted

      // 1. Update profiles table (PRIMARY — source of truth)
      let profileError: any = null
      if (svc) {
        const { error } = await svc.from('profiles').update({
          plan: 'FREE',
          is_pro: false,
          subscription_status: 'inactive',
          pro_status: 'inactive',
          subscription_until: null,
          pro_expiry: null,
          updated_at: new Date().toISOString(),
        }).eq('id', userId)
        profileError = error
        if (error) {
          console.error('❌ [ADMIN PATCH] Profiles table revoke failed:', error.message)
        } else {
          console.log(`✅ [ADMIN PATCH] Profiles table updated to FREE for user: ${userId}`) // PII redacted
        }
      } else {
        console.error('❌ [ADMIN PATCH] Supabase admin client not available for profiles table')
      }

      // 2. Update Auth metadata (secondary — for consistency)
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
        console.error('❌ [ADMIN PATCH] Auth metadata revoke failed:', updateError.message)
      }

      // If BOTH failed, return error
      if (profileError && updateError) {
        return NextResponse.json({
          error: 'Failed to revoke PRO',
          details: `Profiles: ${profileError.message}. Auth: ${updateError.message}`,
        }, { status: 500 })
      }

      // If only Auth failed, still return success (profiles table is source of truth)
      return NextResponse.json({
        message: 'PRO status revoked successfully',
        warnings: updateError ? `Auth metadata sync failed: ${updateError.message}` : undefined,
        user: updatedUser?.user,
      })
    } else if (action === 'activate') {
      console.log(`👑 [ADMIN PATCH] Activating PRO for ${days} days for user: ${userId}`) // PII redacted

      const now = new Date()
      // Check profiles table first for current subscription
      let currentSubUntil: Date = now
      if (svc) {
        const { data: currentProfile } = await svc
          .from('profiles')
          .select('subscription_until, is_pro')
          .eq('id', userId)
          .single()

        if (currentProfile?.subscription_until) {
          const profileDate = new Date(currentProfile.subscription_until)
          if (profileDate > now) {
            currentSubUntil = profileDate
          }
        }
      } else {
        // Fallback to Auth metadata
        if (user.user_metadata?.subscription_until) {
          const metaDate = new Date(user.user_metadata.subscription_until)
          if (metaDate > now) {
            currentSubUntil = metaDate
          }
        }
      }

      const baseDate = currentSubUntil > now ? currentSubUntil : now
      const subscriptionUntil = new Date(baseDate.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString()

      // 1. Update profiles table (PRIMARY — source of truth)
      let profileError: any = null
      if (svc) {
        const { error } = await svc.from('profiles').update({
          plan: 'PRO',
          is_pro: true,
          subscription_status: 'active',
          pro_status: 'active',
          subscription_until: subscriptionUntil,
          pro_expiry: subscriptionUntil,
          has_ever_been_pro: true,
          updated_at: new Date().toISOString(),
        }).eq('id', userId)
        profileError = error
        if (error) {
          console.error('❌ [ADMIN PATCH] Profiles table activate failed:', error.message)
        } else {
          console.log(`✅ [ADMIN PATCH] Profiles table updated to PRO for user: ${userId} until ${subscriptionUntil}`) // PII redacted
        }
      } else {
        console.error('❌ [ADMIN PATCH] Supabase admin client not available for profiles table')
      }

      // 2. Update Auth metadata (secondary — for consistency)
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
        console.error('❌ [ADMIN PATCH] Auth metadata activate failed:', updateError.message)
      }

      // If BOTH failed, return error
      if (profileError && updateError) {
        return NextResponse.json({
          error: 'Failed to activate PRO',
          details: `Profiles: ${profileError.message}. Auth: ${updateError.message}`,
        }, { status: 500 })
      }

      // If only Auth failed, still return success (profiles table is source of truth)
      return NextResponse.json({
        message: `PRO activated for ${days} days`,
        subscription_until: subscriptionUntil,
        warnings: updateError ? `Auth metadata sync failed: ${updateError.message}` : undefined,
        user: updatedUser?.user,
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