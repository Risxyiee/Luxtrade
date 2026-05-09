import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

// POST to sync all Supabase Auth users to Prisma
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting sync of Supabase Auth users to Prisma...')

    // Get all users from Supabase Auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching Supabase Auth users:', authError)
      return NextResponse.json(
        { error: 'Failed to fetch Supabase Auth users', details: String(authError) },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${authUsers?.users?.length || 0} users in Supabase Auth`)

    if (!authUsers?.users || authUsers.users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users in Supabase Auth to sync',
        syncedCount: 0
      })
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

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      syncedCount,
      skippedCount,
      errorCount,
      totalPrismaUsers: allPrismaUsers.length,
      results: syncResults
    })
  } catch (error) {
    console.error('❌ Unexpected error in sync:', error)
    console.error('Full error details:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}

// GET to check sync status
export async function GET(request: NextRequest) {
  try {
    // Get counts
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    const prismaUsers = await db.user.findMany()

    return NextResponse.json({
      supabaseAuthUsers: authUsers?.users?.length || 0,
      prismaUsers: prismaUsers.length,
      syncNeeded: (authUsers?.users?.length || 0) > prismaUsers.length
    })
  } catch (error) {
    console.error('❌ Error checking sync status:', error)
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    )
  }
}
