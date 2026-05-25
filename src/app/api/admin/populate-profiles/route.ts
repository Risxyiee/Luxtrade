import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// One-time script to populate all Supabase Auth users to profiles table
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting profiles population...')

    // Get all users from Supabase Auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

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
      } catch (error) {
        console.error(`   ❌ Error processing user ${authUser.email}:`, error)
        errorCount++
      }
    }

    // Get total profile count
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
    // Check if trigger exists in database
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
