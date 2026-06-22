import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { db } from '@/lib/db'

// Sync logic - shared by GET and POST
// Uses the shared singleton `db` from @/lib/db (auto-pooled, no connection leak)
async function performSync() {
  try {
    console.log('🔄 Starting sync of Supabase Auth users to Prisma...')

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin client is not available. Make sure SUPABASE_SERVICE_ROLE_KEY is configured.')
      return {
        error: 'SUPABASE_SERVICE_ROLE_KEY not configured',
        message: 'Please set SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables',
        troubleshooting: [
            '1. Go to Vercel Project Settings',
            '2. Navigate to Environment Variables',
            '3. Add variable: SUPABASE_SERVICE_ROLE_KEY',
            '4. Get the key from Supabase Dashboard > Project Settings > API',
            '5. Redeploy after adding the variable'
          ],
          envCheck: {
            NODE_ENV: process.env.NODE_ENV,
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'
          }
      }
    }

    // Get all users from Supabase Auth using admin client
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching Supabase Auth users:', authError)
      return {
        error: 'Failed to fetch Supabase Auth users',
        details: JSON.stringify(authError, null, 2)
      }
    }

    console.log(`✅ Found ${authUsers?.users?.length || 0} users in Supabase Auth`)

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
          console.log(`\n📋 Processing user: ${authUser.email}`)

          // Check if user already exists in Prisma by UUID
          const existingUser = await db.user.findUnique({
            where: { id: authUser.id }
          })

          if (existingUser) {
            console.log(`   ⏭️ User already exists in Prisma, skipping`)
          } else {
            const displayName = authUser.user_metadata?.display_name ||
                              authUser.user_metadata?.name ||
                              authUser.user_metadata?.full_name ||
                              null

            console.log(`   ➕ Creating user in Prisma...`)
            await db.user.create({
              data: {
                id: authUser.id,
                email: authUser.email!,
                name: displayName
              }
            })

            console.log(`   ✅ User synced to Prisma successfully`)
            syncedCount++
          }

          // ============================================
          // SYNC TO SUPABASE PROFILES TABLE
          // ============================================
          const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', authUser.id)
            .single()

          if (profileCheckError && profileCheckError.code !== 'PGRST116') {
            console.error(`   ⚠️ Error checking profile:`, profileCheckError)
          }

          if (existingProfile) {
            console.log(`   ✅ Profile already exists in Supabase`)
          } else {
            console.log(`   ➕ Creating profile in Supabase...`)
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
              console.log(`   ✅ Profile created in Supabase successfully`)
              profileSyncedCount++
            }
          }

          return {
            email: authUser.email,
            action: existingUser ? 'skipped' : 'created',
            userId: authUser.id,
            profileCreated: !existingProfile
          }
        } catch (error) {
          console.error(`   ❌ Error syncing user ${authUser.email}:`, error)

          if ((error as any)?.code === 'P2002' || (error as any)?.code === 'P2003') {
            console.log(`   ⏭️ User already exists (duplicate), skipping`)
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
            error: JSON.stringify(error, null, 2)
          }
        }
      })
    )

    // Get final counts
    const allPrismaUsers = await db.user.findMany()
    const { count: profileCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    console.log('\n📊 Sync Summary:')
    console.log(`   ✅ Prisma Users synced: ${syncedCount}`)
    console.log(`   ✅ Supabase Profiles synced: ${profileSyncedCount}`)
    console.log(`   ⏭️ Skipped: ${skippedCount} users`)
    console.log(`   ❌ Errors: ${errorCount} users`)
    console.log(`   📋 Total users in Prisma: ${allPrismaUsers.length}`)
    console.log(`   📋 Total profiles in Supabase: ${profileCount || 0}`)

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
  } catch (error) {
    console.error('❌ Unexpected error in sync:', error)
    return {
      error: 'Sync failed',
      details: JSON.stringify(error, null, 2),
      errorType: (error as any)?.constructor?.name || 'Unknown',
      errorCode: (error as any)?.code || 'NO_CODE',
      errorMessage: (error as any)?.message || String(error)
    }
  }
}

// GET to sync all Supabase Auth users to Prisma (PUBLIC ACCESS - no auth required)
export async function GET(request: NextRequest) {
  console.log('📥 GET /api/admin/sync-auth-users')
  const result = await performSync()
  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }
  return NextResponse.json(result)
}

// POST to sync all Supabase Auth users to Prisma (for Admin Panel)
export async function POST(request: NextRequest) {
  console.log('📥 POST /api/admin/sync-auth-users')
  const result = await performSync()
  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }
  return NextResponse.json(result)
}
