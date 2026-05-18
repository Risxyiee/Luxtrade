import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, fullName } = body

    console.log('🔄 Syncing user:', { userId, email, fullName })

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId and email are required' },
        { status: 400 }
      )
    }

    // Use Supabase admin to update user metadata
    const supabaseAdmin = getSupabaseAdmin()

    const { data: user, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email: email,
        user_metadata: {
          full_name: fullName || email.split('@')[0],
          email: email,
        }
      }
    )

    if (error) {
      console.error('❌ Error updating user in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to sync user to Supabase' },
        { status: 500 }
      )
    }

    console.log('✅ User synced successfully')
    return NextResponse.json({
      success: true,
      action: 'synced',
      user: {
        id: user.user.id,
        email: user.user.email,
        name: user.user.user_metadata?.full_name || email.split('@')[0]
      }
    })
  } catch (error) {
    console.error('❌ Error syncing user:', error)
    return NextResponse.json(
      { error: 'Failed to sync user' },
      { status: 500 }
    )
  }
}
