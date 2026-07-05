import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSupabaseAdminAuthFromClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

// One-time script to populate all Supabase Auth users to profiles table
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    console.log('🚀 Starting profiles population...')

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json({ error: 'Supabase Admin tidak tersedia' }, { status: 500 })
    }

    // Get all users from Supabase Auth
    const { data: authUsers, error: authError } = await authAdmin.listUsers()

    if (authError) {
      console.error('❌ Error fetching Supabase Auth users:', authError)
      return NextResponse.json({
        error: 'Failed to fetch Supabase Auth users',
        details: JSON.stringify(authError, null, 2)
      }, { status: 500 })
    }

    console.log(`✅ Found ${authUsers?.users?.length || 0} users in Supabase Auth`)

    if (!authUsers?.users || authUsers.users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users in Supabase Auth',
        profileCount: 0
      })
    }

    // Populate profiles for all users
    let createdCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const authUser of authUsers.users) {
      try {
        console.log(`\n📋 Processing: ${authUser.email} (${authUser.id})`)

        if (!supabaseAdmin) continue

        // Check if profile already exists
        const { data: existingProfile, error: checkError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', authUser.id)
          .single()

        if (existingProfile) {
          console.log(`   ⏭️ Profile already exists`)
          skippedCount++
          continue
        }

        // Create profile
        const fullName = authUser.user_metadata?.display_name ||
                       authUser.user_metadata?.name ||
                       authUser.user_metadata?.full_name ||
                       null

        const { error: insertError } = await supabaseAdmin
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

        if (insertError) {
          console.error(`   ❌ Error creating profile:`, insertError)
          errorCount++
        } else {
          console.log(`   ✅ Profile created`)
          createdCount++
        }
      } catch (err) {
        console.error(`   ❌ Error processing user ${authUser.email}:`, err)
        errorCount++
      }
    }

    // Get total profile count
    if (supabaseAdmin) {
      const { count: totalProfiles } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      console.log('\n📊 Population Summary:')
      console.log(`   ✅ Created: ${createdCount} profiles`)
      console.log(`   ⏭️ Skipped: ${skippedCount} profiles`)
      console.log(`   ❌ Errors: ${errorCount}`)
      console.log(`   📋 Total profiles: ${totalProfiles || 0}`)

      return NextResponse.json({
        success: true,
        message: 'Profiles population completed',
        createdCount,
        skippedCount,
        errorCount,
        totalProfiles: totalProfiles || 0
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Profiles population completed',
      createdCount,
      skippedCount,
      errorCount,
      totalProfiles: 0
    })
  } catch (error) {
    console.error('❌ Error in populate profiles:', error)
    return NextResponse.json({
      error: 'Population failed',
      details: JSON.stringify(error, null, 2)
    }, { status: 500 })
  }
}

// GET to check trigger status
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase Admin tidak tersedia' }, { status: 500 })
    }

    const { data: triggerInfo } = await supabaseAdmin
      .from('profiles')
      .select('count')
      .limit(1)

    return NextResponse.json({
      success: true,
      message: 'Use POST to populate profiles',
      currentProfileCount: triggerInfo?.length || 0
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check profiles',
      details: JSON.stringify(error, null, 2)
    }, { status: 500 })
  }
}