import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { db } from '@/lib/db'
import { PrismaClient } from '@prisma/client'

// Sync logic - shared by GET and POST
async function performSync() {
  try {
    console.log('🔄 Starting sync of Supabase Auth users to Prisma...')
    console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET')
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
      SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
      DATABASE_URL: process.env.DATABASE_URL ? 'SET (Length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET',
      DATABASE_URL_STARTS_WITH: process.env.DATABASE_URL?.startsWith('postgres') ? 'postgres://...' : 'OTHER',
      DATABASE_URL_IS_FILE: process.env.DATABASE_URL?.includes('file:') || false,
    })

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin client is not available. Make sure SUPABASE_SERVICE_ROLE_KEY is configured.')
      console.error('   Check if SUPABASE_SERVICE_ROLE_KEY is set in Vercel Environment Variables')
      console.error('   Expected variable name exactly: SUPABASE_SERVICE_ROLE_KEY')
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
          console.log(`   UID: ${authUser.id}`)
          console.log(`   Display Name: ${authUser.user_metadata?.display_name || authUser.user_metadata?.name || 'N/A'}`)

          // Check if user already exists in Prisma by UUID
          const existingUser = await db.user.findUnique({
            where: { id: authUser.id }
          })

          if (existingUser) {
            console.log(`   ⏭️ User already exists in Prisma, skipping Prisma sync`)
          } else {
            // Extract display name from metadata
            const displayName = authUser.user_metadata?.display_name ||
                              authUser.user_metadata?.name ||
                              authUser.user_metadata?.full_name ||
                              null

            // Create new user in Prisma with SAME UUID
            console.log(`   ➕ Creating user in Prisma...`)
            const newUser = await db.user.create({
              data: {
                id: authUser.id, // Use same UUID as Supabase Auth UID
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
          console.log(`   🔍 Checking Supabase profiles table...`)

          // Check if profile exists in Supabase
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
            // Create profile in Supabase
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
              // Non-blocking error - continue
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

          // Check if it's a unique constraint error (user already exists)
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

    // Get final user count from Prisma
    const allPrismaUsers = await db.user.findMany()

    // Get final profile count from Supabase
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
    console.error('Full error details:', JSON.stringify(error, null, 2))
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

  // Log DATABASE_URL for debugging
  console.log('🔗 DATABASE_URL (Full Check):')
  console.log('   - Exists:', !!process.env.DATABASE_URL)
  console.log('   - Length:', process.env.DATABASE_URL?.length || 0)
  console.log('   - Starts with postgres:', process.env.DATABASE_URL?.startsWith('postgres') || false)
  console.log('   - Contains file:', process.env.DATABASE_URL?.includes('file:') || false)
  console.log('   - First 50 chars:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET')

  // Force fresh Prisma client
  const freshDb = new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

  // Test database connection
  try {
    console.log('🔍 Testing database connection...')
    const testResult = await freshDb.$queryRaw`SELECT 1 as test`
    console.log('✅ Database connection successful:', testResult)
  } catch (dbError) {
    console.error('❌ Database connection FAILED:', dbError)
    console.error('Error details:', JSON.stringify(dbError, null, 2))
    return NextResponse.json({
      error: 'Database connection failed',
      details: JSON.stringify(dbError, null, 2),
      errorType: (dbError as any)?.constructor?.name || 'Unknown',
      errorCode: (dbError as any)?.code || 'NO_CODE',
      errorMessage: (dbError as any)?.message || String(dbError),
      databaseUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET',
      databaseUrlExists: !!process.env.DATABASE_URL,
      databaseUrlIsPostgres: process.env.DATABASE_URL?.startsWith('postgres') || false,
      databaseUrlIsFile: process.env.DATABASE_URL?.includes('file:') || false
    }, { status: 500 })
  }

  // Replace db with fresh instance
  Object.assign(db, freshDb)

  const result = await performSync()

  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

// POST to sync all Supabase Auth users to Prisma (for Admin Panel)
export async function POST(request: NextRequest) {
  console.log('📥 POST /api/admin/sync-auth-users')

  // Log DATABASE_URL for debugging
  console.log('🔗 DATABASE_URL (Full Check):')
  console.log('   - Exists:', !!process.env.DATABASE_URL)
  console.log('   - Length:', process.env.DATABASE_URL?.length || 0)
  console.log('   - Starts with postgres:', process.env.DATABASE_URL?.startsWith('postgres') || false)
  console.log('   - Contains file:', process.env.DATABASE_URL?.includes('file:') || false)
  console.log('   - First 50 chars:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET')

  // Force fresh Prisma client
  const freshDb = new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

  // Test database connection
  try {
    console.log('🔍 Testing database connection...')
    const testResult = await freshDb.$queryRaw`SELECT 1 as test`
    console.log('✅ Database connection successful:', testResult)
  } catch (dbError) {
    console.error('❌ Database connection FAILED:', dbError)
    console.error('Error details:', JSON.stringify(dbError, null, 2))
    return NextResponse.json({
      error: 'Database connection failed',
      details: JSON.stringify(dbError, null, 2),
      errorType: (dbError as any)?.constructor?.name || 'Unknown',
      errorCode: (dbError as any)?.code || 'NO_CODE',
      errorMessage: (dbError as any)?.message || String(dbError),
      databaseUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET',
      databaseUrlExists: !!process.env.DATABASE_URL,
      databaseUrlIsPostgres: process.env.DATABASE_URL?.startsWith('postgres') || false,
      databaseUrlIsFile: process.env.DATABASE_URL?.includes('file:') || false
    }, { status: 500 })
  }

  const result = await performSync()

  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
