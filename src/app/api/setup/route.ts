import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// One-time setup script for LuxTrade
// Run this endpoint once to set up the database and upgrade admin to PRO

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://biqtkulvmqtikflcmqad.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Admin emails to auto-upgrade to PRO
const ADMIN_EMAILS = ['luxtradee@gmail.com']

export async function GET() {
  const results = {
    success: false,
    steps: [] as string[],
    errors: [] as string[],
    profiles: null as unknown,
  }

  try {
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    results.steps.push('✅ Connected to Supabase')

    // Step 1: Check if profiles table exists
    const { error: tableCheckError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    if (tableCheckError) {
      results.steps.push('⚠️ Profiles table may not exist. Creating...')
      
      // Try to create the table using RPC or direct SQL
      // Note: You may need to run the SQL manually in Supabase Dashboard
      results.steps.push('📝 Please run the SQL script in Supabase SQL Editor:')
      results.steps.push('   File: supabase/profiles-schema.sql')
    } else {
      results.steps.push('✅ Profiles table exists')
    }

    // Step 2: Get all users from auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      results.errors.push(`Failed to fetch users: ${usersError.message}`)
    } else {
      results.steps.push(`✅ Found ${users.length} users in auth`)
    }

    // Step 3: Get existing profiles
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')

    if (profilesError) {
      results.errors.push(`Failed to fetch profiles: ${profilesError.message}`)
    } else {
      results.steps.push(`✅ Found ${existingProfiles?.length || 0} profiles`)
    }

    // Step 4: Create profiles for users without profiles
    if (users && users.length > 0) {
      const profileMap = new Map(existingProfiles?.map((p: { id: string }) => [p.id, true]) || [])
      
      for (const user of users) {
        if (!profileMap.has(user.id)) {
          const isAdmin = ADMIN_EMAILS.includes(user.email || '')
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || '',
              subscription_status: isAdmin ? 'PRO' : 'FREE',
              is_pro: isAdmin,
              subscription_end: isAdmin ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null
            })
          
          if (insertError) {
            results.errors.push(`Failed to create profile for ${user.email}: ${insertError.message}`)
          } else {
            results.steps.push(`✅ Created profile for ${user.email}${isAdmin ? ' (PRO)' : ''}`)
          }
        }
      }
    }

    // Step 5: Upgrade admin users to PRO
    for (const adminEmail of ADMIN_EMAILS) {
      const adminUser = users?.find(u => u.email === adminEmail)
      
      if (adminUser) {
        const { error: updateError } = await supabase
          .from('profiles')
          .upsert({
            id: adminUser.id,
            email: adminEmail,
            subscription_status: 'PRO',
            is_pro: true,
            subscription_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
        
        if (updateError) {
          results.errors.push(`Failed to upgrade ${adminEmail} to PRO: ${updateError.message}`)
        } else {
          results.steps.push(`👑 UPGRADED ${adminEmail} to PRO!`)
        }
      } else {
        results.steps.push(`⚠️ Admin user ${adminEmail} not found in auth`)
      }
    }

    // Step 6: Return final profiles
    const { data: finalProfiles } = await supabase
      .from('profiles')
      .select('email, subscription_status, is_pro')
    
    results.profiles = finalProfiles
    results.success = results.errors.length === 0

    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    results.errors.push(`Unexpected error: ${error}`)
    return NextResponse.json(results, { status: 500 })
  }
}

// Also support POST for manual trigger
export async function POST() {
  return GET()
}
