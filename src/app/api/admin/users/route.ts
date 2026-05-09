import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET all users from Supabase
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Attempting to fetch users from Supabase...')

    // Try fetching from 'profiles' table first (common Supabase pattern)
    let { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('❌ Error fetching from profiles table:', profilesError)

      // Try 'users' table as fallback
      console.log('🔄 Trying users table...')
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (usersError) {
        console.error('❌ Error fetching from users table:', usersError)
        console.error('Full error details:', JSON.stringify(usersError, null, 2))

        return NextResponse.json(
          { error: 'Failed to fetch users. Check console for details.' },
          { status: 500 }
        )
      }

      if (users) {
        console.log(`✅ Successfully fetched ${users.length} users from users table`)
        console.log('Users data:', JSON.stringify(users, null, 2))

        // Get subscription count for each user
        const usersWithSubCount = await Promise.all(
          users.map(async (user: any) => {
            const { count } = await supabase
              .from('user_subscriptions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)

            return {
              id: user.id,
              email: user.email,
              name: user.full_name || user.name || null,
              createdAt: user.created_at,
              updatedAt: user.updated_at,
              subscriptionCount: count || 0
            }
          })
        )

        return NextResponse.json({ users: usersWithSubCount })
      }
    }

    if (profiles) {
      console.log(`✅ Successfully fetched ${profiles.length} users from profiles table`)
      console.log('Profiles data:', JSON.stringify(profiles, null, 2))

      // Get subscription count for each user
      const usersWithSubCount = await Promise.all(
        profiles.map(async (profile: any) => {
          const { count } = await supabase
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id)

          return {
            id: profile.id,
            email: profile.email,
            name: profile.full_name || profile.name || null,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
            subscriptionCount: count || 0
          }
        })
      )

      return NextResponse.json({ users: usersWithSubCount })
    }

    console.log('⚠️ No data found from any table')
    return NextResponse.json({ users: [] })

  } catch (error) {
    console.error('❌ Unexpected error in GET /api/admin/users:', error)
    console.error('Full error details:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// POST create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    console.log('📝 Creating new user:', { email, name })

    // Try inserting into profiles table first
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        email,
        full_name: name || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (profileError) {
      console.error('❌ Error creating user in profiles:', profileError)

      // Try users table
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          full_name: name || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (userError) {
        console.error('❌ Error creating user in users:', userError)
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        )
      }

      console.log('✅ User created successfully:', user)
      return NextResponse.json({ user })
    }

    console.log('✅ User created successfully:', profile)
    return NextResponse.json({ user: profile })
  } catch (error) {
    console.error('❌ Unexpected error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
