import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAdminAuth } from '@/lib/supabase-admin-alt'
import { requireAdmin } from '@/lib/admin-auth'

// Sync logic - shared by GET and POST
async function performSync() {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return {
        error: 'SUPABASE_SERVICE_ROLE_KEY not configured',
        message: 'Please set SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables',
      }
    }

    const authAdmin = getAdminAuth()
    if (!authAdmin) {
      return {
        error: 'SUPABASE_SERVICE_ROLE_KEY not configured',
        message: 'Admin auth API not available',
      }
    }

    // Get all users from Supabase Auth using admin client (paginated)
    let allAuthUsers: any[] = []
    let page = 1
    const perPage = 500
    while (true) {
      const { data: pageData, error: listErr } = await authAdmin.listUsers({ page, perPage })
      if (listErr || !pageData?.users?.length) break
      allAuthUsers.push(...pageData.users)
      if (pageData.users.length < perPage) break
      page++
    }

    if (allAuthUsers.length === 0) {
      return {
        success: true,
        message: 'No users in Supabase Auth to sync',
        syncedCount: 0
      }
    }

    // Sync each user to Supabase profiles
    let skippedCount = 0
    let errorCount = 0
    let profileSyncedCount = 0

    const syncResults = await Promise.all(
      allAuthUsers.map(async (authUser: any) => {
        try {
          // SYNC TO SUPABASE PROFILES TABLE
          const { data: existingProfile, error: profileCheckError } = await admin
            .from('profiles')
            .select('id')
            .eq('id', authUser.id)
            .single()

          if (profileCheckError && profileCheckError.code !== 'PGRST116') {
            // non-critical
          }

          if (existingProfile) {
            skippedCount++
            return {
              email: authUser.email,
              action: 'skipped',
              userId: authUser.id,
              profileCreated: false
            }
          } else {
            const fullName = authUser.user_metadata?.display_name ||
                           authUser.user_metadata?.name ||
                           authUser.user_metadata?.full_name ||
                           null

            const { error: profileCreateError } = await admin
              .from('profiles')
              .insert({
                id: authUser.id,
                email: authUser.email!,
                full_name: fullName,
                subscription_status: 'FREE',
                is_pro: false,
                subscription_until: null,
                pro_status: 'inactive',
                pro_expiry: null,
                affiliate_balance: 0,
                referral_count: 0,
                commission_paid: false,
                has_ever_been_pro: false,
                device_id: null,
                my_referral_code: null,
                referred_by_code: null,
                referral_code_changes: 2,
                referral_status: null,
                created_at: authUser.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
              })

            if (profileCreateError) {
              console.error(`   ❌ Error creating profile:`, profileCreateError)
              errorCount++
              return {
                email: authUser.email,
                action: 'error',
                error: JSON.stringify(profileCreateError, null, 2)
              }
            } else {
              profileSyncedCount++
              return {
                email: authUser.email,
                action: 'created',
                userId: authUser.id,
                profileCreated: true
              }
            }
          }
        } catch (err) {
          console.error(`   ❌ Error syncing user ${authUser.email}:`, err)

          if ((err as any)?.code === '23505') {
            // unique violation = duplicate
            skippedCount++
            return {
              email: authUser.email,
              action: 'skipped',
              reason: 'duplicate'
            }
          }

          errorCount++
          return {
            email: authUser.email,
            action: 'error',
            error: JSON.stringify(err, null, 2)
          }
        }
      })
    )

    // Get final counts
    const { count: profileCount } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    return {
      success: true,
      message: 'Sync completed',
      syncedCount: profileSyncedCount,
      profileSyncedCount,
      skippedCount,
      errorCount,
      totalSupabaseProfiles: profileCount || 0,
      results: syncResults
    }
  } catch (err) {
    console.error('❌ Unexpected error in sync:', err)
    return {
      error: 'Sync failed',
      details: JSON.stringify(err, null, 2),
      errorType: (err as any)?.constructor?.name || 'Unknown',
      errorCode: (err as any)?.code || 'NO_CODE',
      errorMessage: (err as any)?.message || String(err)
    }
  }
}

// GET to sync all Supabase Auth users to profiles
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult.error) return authResult.error

  const result = await performSync()
  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }
  return NextResponse.json(result)
}

// POST to sync all Supabase Auth users to profiles (for Admin Panel)
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult.error) return authResult.error

  const result = await performSync()
  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }
  return NextResponse.json(result)
}