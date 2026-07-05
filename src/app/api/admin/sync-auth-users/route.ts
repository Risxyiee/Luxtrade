import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSupabaseAdminAuthFromClient } from '@/lib/supabase'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

// Sync logic - shared by GET and POST
async function performSync() {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      return {
        error: 'SUPABASE_SERVICE_ROLE_KEY not configured',
        message: 'Please set SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables',
      }
    }

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return {
        error: 'SUPABASE_SERVICE_ROLE_KEY not configured',
        message: 'Admin auth API not available',
      }
    }

    // Get all users from Supabase Auth using admin client
    const { data: authUsers, error: authError } = await authAdmin.listUsers()

    if (authError) {
      console.error('❌ Error fetching Supabase Auth users:', authError)
      return {
        error: 'Failed to fetch Supabase Auth users',
        details: JSON.stringify(authError, null, 2)
      }
    }

    if (!authUsers?.users || authUsers.users.length === 0) {
      return {
        success: true,
        message: 'No users in Supabase Auth to sync',
        syncedCount: 0
      }
    }

    // Sync each user to Prisma AND Supabase profiles
    let syncedCount = 0
    let skippedCount = 0
    let errorCount = 0
    let profileSyncedCount = 0

    const syncResults = await Promise.all(
      authUsers.users.map(async (authUser) => {
        try {
          // Check if user already exists in Prisma by UUID
          const existingUser = await db.user.findUnique({
            where: { id: authUser.id }
          })

          if (existingUser) {
            // User already exists, skip
          } else {
            const displayName = authUser.user_metadata?.display_name ||
                              authUser.user_metadata?.name ||
                              authUser.user_metadata?.full_name ||
                              null

            await db.user.create({
              data: {
                id: authUser.id,
                email: authUser.email!,
                name: displayName
              }
            })

            syncedCount++
          }

          // SYNC TO SUPABASE PROFILES TABLE
          const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', authUser.id)
            .single()

          if (profileCheckError && profileCheckError.code !== 'PGRST116') {
            // non-critical
          }

          if (existingProfile) {
            // Profile already exists, skip
          } else {
            const fullName = authUser.user_metadata?.display_name ||
                           authUser.user_metadata?.name ||
                           authUser.user_metadata?.full_name ||
                           null

            const { error: profileCreateError } = await supabaseAdmin
              .from('profiles')
              .insert({
                id: authUser.id,
                email: authUser.email!,
                full_name: fullName,
                subscription_status: 'FREE',
                is_pro: false,
                subscription_until: null,
                pro_status: 'inactive',
                pro_expiry_date: null,
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
            } else {
              profileSyncedCount++
            }
          }

          return {
            email: authUser.email,
            action: existingUser ? 'skipped' : 'created',
            userId: authUser.id,
            profileCreated: !existingProfile
          }
        } catch (err) {
          console.error(`   ❌ Error syncing user ${authUser.email}:`, err)

          if ((err as any)?.code === 'P2002' || (err as any)?.code === 'P2003') {
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
    const allPrismaUsers = await db.user.findMany()
    const { count: profileCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    return {
      success: true,
      message: 'Sync completed',
      syncedCount,
      profileSyncedCount,
      skippedCount,
      errorCount,
      totalPrismaUsers: allPrismaUsers.length,
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

// GET to sync all Supabase Auth users to Prisma
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult.error) return authResult.error

  const result = await performSync()
  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }
  return NextResponse.json(result)
}

// POST to sync all Supabase Auth users to Prisma (for Admin Panel)
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult.error) return authResult.error

  const result = await performSync()
  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }
  return NextResponse.json(result)
}