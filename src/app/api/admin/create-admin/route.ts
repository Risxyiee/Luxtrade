import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAIL = 'luxtradee@gmail.com'

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Creating admin user:', ADMIN_EMAIL)

    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if user exists in auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      throw listError
    }

    const existingUser = users.find(u => u.email === ADMIN_EMAIL)

    if (existingUser) {
      console.log('✅ Admin user already exists in auth:', existingUser.id)
      return NextResponse.json({
        success: true,
        message: 'Admin user already exists',
        admin: {
          id: existingUser.id,
          email: existingUser.email,
          emailConfirmed: existingUser.email_confirmed_at
        }
      })
    }

    // Create admin user in Supabase Auth
    const { data: newAdmin, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      email_confirm: true,
      user_metadata: {
        name: 'LuxTrade Admin',
        role: 'ADMIN'
      }
    })

    if (createError) {
      console.error('Error creating admin:', createError)
      throw createError
    }

    console.log('✅ Admin user created in auth:', newAdmin.user.id)

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      admin: {
        id: newAdmin.user.id,
        email: newAdmin.user.email,
        emailConfirmed: newAdmin.user.email_confirmed_at
      }
    })
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    return NextResponse.json(
      {
        error: 'Failed to create admin user',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
