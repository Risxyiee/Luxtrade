import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const { userId } = body

    console.log('❌ API cancel-subscription called')
    console.log('   userId:', userId)

    if (!userId) {
      console.error('❌ Missing userId')
      return NextResponse.json(
        { error: 'Missing userId', details: 'userId is required' },
        { status: 400 }
      )
    }

    // ========================================
    // Create Supabase admin client directly
    // ========================================
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error', details: 'Supabase environment variables are not configured' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // ========================================
    // STEP 1: Validate userId exists in Supabase
    // ========================================
    console.log('📋 Step 1: Validating user exists in Supabase...')

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (fetchError || !profile) {
      console.error('❌ User not found in Supabase:', userId)
      if (fetchError) {
        console.error('   Error:', fetchError.message)
      }
      return NextResponse.json(
        { error: 'User not found', details: `User with ID ${userId} does not exist` },
        { status: 404 }
      )
    }

    console.log('✅ User found:', profile.email)

    // ========================================
    // STEP 2: Update Supabase profile back to FREE
    // ========================================
    console.log('📋 Step 2: Updating Supabase profile back to FREE...')

    const { error: profileUpdateError, data: updatedData } = await supabaseAdmin
      .from('profiles')
      .update({
        plan: 'FREE',
        is_pro: false,
        subscription_until: null,
        has_ever_been_pro: false,
        pro_expiry: null,
        pro_status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()

    if (profileUpdateError) {
      console.error('❌ Failed to update Supabase profile:', profileUpdateError)
      console.error('   Error code:', profileUpdateError.code)
      console.error('   Error message:', profileUpdateError.message)
      console.error('   Error details:', profileUpdateError.details)
      return NextResponse.json(
        { error: 'Failed to cancel subscription', details: profileUpdateError.message },
        { status: 500 }
      )
    }

    console.log('✅ Supabase profile updated to FREE for:', profile.email)
    console.log('   Updated data:', updatedData)

    console.log('✅ Subscription cancelled successfully!')
    return NextResponse.json({
      success: true,
      message: `Subscription for ${profile.email} cancelled successfully`,
      data: {
        userId,
        userEmail: profile.email
      }
    })
  } catch (error) {
    console.error('❌ ERROR DETAIL:', error)
    console.error('   Error type:', error?.constructor?.name)
    console.error('   Error message:', error instanceof Error ? error.message : String(error))
    console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json(
      {
        error: 'Failed to cancel subscription',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}