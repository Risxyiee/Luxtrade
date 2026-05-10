// Run this script to populate profiles table
// Usage: bun run populate-profiles.js

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'NOT SET')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function main() {
  console.log('🚀 Starting profiles population...\n')

  try {
    // 1. Get all auth users
    console.log('📥 Fetching users from Supabase Auth...')
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
      process.exit(1)
    }

    const authUsers = authData?.users || []
    console.log(`✅ Found ${authUsers.length} users in Supabase Auth\n`)

    if (authUsers.length === 0) {
      console.log('⚠️ No users found in Supabase Auth')
      process.exit(0)
    }

    // 2. Get existing profiles
    console.log('🔍 Checking existing profiles...')
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')

    if (profilesError) {
      console.error('⚠️ Could not check profiles (table might not exist):', profilesError.message)
    } else {
      console.log(`✅ Found ${existingProfiles?.length || 0} existing profiles\n`)
    }

    // 3. Populate profiles
    let createdCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const user of authUsers) {
      try {
        console.log(`📋 Processing: ${user.email} (${user.id.substring(0, 8)}...)`)

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (existingProfile) {
          console.log(`   ⏭️ Profile already exists\n`)
          skippedCount++
          continue
        }

        // Create profile
        const fullName = user.user_metadata?.display_name ||
                       user.user_metadata?.name ||
                       user.user_metadata?.full_name ||
                       null

        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
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
            referred_by_code: user.user_metadata?.referral_code || null,
            referral_code_changes: 2,
            referral_status: null,
            created_at: user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (insertError) {
          console.error(`   ❌ Error:`, insertError.message)
          errorCount++
        } else {
          console.log(`   ✅ Profile created\n`)
          createdCount++
        }
      } catch (err) {
        console.error(`   ❌ Error processing user:`, err.message)
        errorCount++
      }
    }

    // 4. Final count
    const { count: finalCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    console.log('\n📊 SUMMARY:')
    console.log(`   ✅ Created: ${createdCount} profiles`)
    console.log(`   ⏭️ Skipped: ${skippedCount} profiles`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   📋 Total profiles: ${finalCount || 0}\n`)

    if (finalCount > 0) {
      console.log('🎉 Success! Profiles table is now populated.')
      console.log('👉 Check Supabase Table Editor > profiles table\n')
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
