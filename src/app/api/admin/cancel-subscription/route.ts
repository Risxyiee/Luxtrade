import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
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

    // Use supabaseAdmin if available (Service Role Key), otherwise use regular client
    const supabaseClient = supabaseAdmin || supabase

    if (!supabaseAdmin) {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not configured. Using regular client. Updates may fail due to RLS policies.')
    }

    // ========================================
    // STEP 1: Find user in Prisma
    // ========================================
    console.log('📋 Step 1: Finding user in Prisma...')
    const user = await db.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error('❌ User not found in Prisma:', userId)
      return NextResponse.json(
        { error: 'User not found', details: `User with ID ${userId} does not exist` },
        { status: 404 }
      )
    }
    console.log('✅ User found:', user.email)

    // ========================================
    // STEP 2: Delete or deactivate subscriptions in Prisma
    // ========================================
    console.log('📋 Step 2: Canceling subscriptions...')
    const activeSubscriptions = await db.userSubscription.findMany({
      where: {
        userId,
        isActive: true
      }
    })

    console.log(`   Found ${activeSubscriptions.length} active subscriptions`)

    if (activeSubscriptions.length > 0) {
      for (const sub of activeSubscriptions) {
        await db.userSubscription.update({
          where: { id: sub.id },
          data: {
            isActive: false,
            adminNote: `${sub.adminNote || ''} (Cancelled by admin)`
          }
        })
        console.log(`   Deactivated subscription: ${sub.id}`)
      }
    }

    // ========================================
    // STEP 3: Update Supabase profiles table back to FREE
    // ========================================
    console.log('📋 Step 3: Updating Supabase profile back to FREE...')

    const { error: profileUpdateError, data: updatedData } = await supabaseClient
      .from('profiles')
      .update({
        subscription_status: 'FREE',
        is_pro: false,
        subscription_until: null,
        pro_status: 'inactive',
        pro_expiry_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('email', user.email)
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
    } else {
      console.log('✅ Supabase profile updated to FREE for:', user.email)
      console.log('   Updated data:', updatedData)
    }

    console.log('✅ Subscription cancelled successfully!')
    return NextResponse.json({
      success: true,
      message: `Subscription for ${user.email} cancelled successfully`,
      data: {
        userId,
        userEmail: user.email,
        subscriptionsCancelled: activeSubscriptions.length
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
