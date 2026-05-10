import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { db } from '@/lib/db'

// Sync logic - shared by GET and POST
async function performSync() {
  try {
    console.log('🔄 Starting sync of Supabase Auth users to Prisma...')
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
      SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
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
        error: 'Failed to fetch Supabase Auth users', details: String(authError)
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

    // Sync each user to Prisma
    let syncedCount = 0
    let skippedCount = 0
    let errorCount = 0

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
            console.log(`   ⏭️ User already exists, skipping`)
            skippedCount++
            return {
              email: authUser.email,
              action: 'skipped',
              reason: 'already_exists'
            }
          }

          // Extract display name from metadata
          const displayName = authUser.user_metadata?.display_name ||
                            authUser.user_metadata?.name ||
                            authUser.user_metadata?.full_name ||
                            null

          // Create new user in Prisma with SAME UUID
          console.log(`   ➕ Creating user in database...`)
          const newUser = await db.user.create({
            data: {
              id: authUser.id, // Use same UUID as Supabase Auth UID
              email: authUser.email!,
              name: displayName
            }
          })

          console.log(`   ✅ User synced successfully`)
          syncedCount++

          return {
            email: authUser.email,
            action: 'created',
            userId: newUser.id
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
            error: String(error)
          }
        }
      })
    )

    // Get final user count from Prisma
    const allPrismaUsers = await db.user.findMany()

    console.log('\n📊 Sync Summary:')
    console.log(`   ✅ Synced: ${syncedCount} users`)
    console.log(`   ⏭️ Skipped: ${skippedCount} users`)
    console.log(`   ❌ Errors: ${errorCount} users`)
    console.log(`   📋 Total users in Prisma: ${allPrismaUsers.length}`)

    return {
      success: true,
      message: 'Sync completed',
      syncedCount,
      skippedCount,
      errorCount,
      totalPrismaUsers: allPrismaUsers.length,
      results: syncResults
    }
  } catch (error) {
    console.error('❌ Unexpected error in sync:', error)
    console.error('Full error details:', JSON.stringify(error, null, 2))
    return {
      error: 'Sync failed', details: String(error)
    }
  }
}

// GET to sync all Supabase Auth users to Prisma (PUBLIC ACCESS - no auth required)
export async function GET(request: NextRequest) {
  const result = await performSync()

  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

// POST to sync all Supabase Auth users to Prisma (for Admin Panel)
export async function POST(request: NextRequest) {
  const result = await performSync()

  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
