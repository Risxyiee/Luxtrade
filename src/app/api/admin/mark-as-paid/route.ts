import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { affiliateId } = body

    console.log('💰 API mark-as-paid called')
    console.log('   affiliateId:', affiliateId)

    if (!affiliateId) {
      console.error('❌ Missing affiliateId')
      return NextResponse.json(
        { error: 'Missing affiliateId', details: 'affiliateId is required' },
        { status: 400 }
      )
    }

    // Use supabaseAdmin if available (Service Role Key), otherwise use regular client
    const supabaseClient = supabaseAdmin || supabase

    if (!supabaseAdmin) {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not configured. Using regular client. Updates may fail due to RLS policies.')
    }

    // ========================================
    // STEP 1: Find affiliate profile
    // ========================================
    console.log('📋 Step 1: Finding affiliate profile...')
    const affiliate = await db.affiliateProfile.findUnique({
      where: { userId: affiliateId }
    })

    if (!affiliate) {
      console.error('❌ Affiliate not found:', affiliateId)
      return NextResponse.json(
        { error: 'Affiliate not found', details: `Affiliate with ID ${affiliateId} does not exist` },
        { status: 404 }
      )
    }
    console.log('✅ Affiliate found:', affiliate.email)

    // ========================================
    // STEP 2: Update affiliate balance in Prisma
    // ========================================
    console.log('📋 Step 2: Updating affiliate balance...')
    const currentBalance = affiliate.affiliateBalance || 0
    const pendingCommission = affiliate.totalCommissionPending || 0

    const updatedAffiliate = await db.affiliateProfile.update({
      where: { userId: affiliateId },
      data: {
        affiliateBalance: { increment: pendingCommission },
        totalCommission: { increment: pendingCommission },
        totalCommissionPending: 0
      }
    })

    console.log('✅ Affiliate balance updated in Prisma')
    console.log('   Previous balance:', currentBalance)
    console.log('   Amount paid:', pendingCommission)
    console.log('   New balance:', currentBalance + pendingCommission)

    // ========================================
    // STEP 3: Update affiliate profile in Supabase
    // ========================================
    console.log('📋 Step 3: Updating Supabase profile...')
    const { error: profileUpdateError } = await supabaseClient
      .from('profiles')
      .update({
        affiliate_balance: currentBalance + pendingCommission,
        total_commission: affiliate.totalCommission + pendingCommission,
        updated_at: new Date().toISOString()
      })
      .eq('email', affiliate.email)

    if (profileUpdateError) {
      console.error('❌ Failed to update Supabase profile:', profileUpdateError)
      console.error('   Error code:', profileUpdateError.code)
      console.error('   Error message:', profileUpdateError.message)
      // Non-blocking error - continue execution
    } else {
      console.log('✅ Supabase profile updated')
    }

    console.log('✅ Mark as paid completed successfully!')
    return NextResponse.json({
      success: true,
      message: `Commission marked as paid for ${affiliate.email}`,
      data: {
        affiliateId,
        email: affiliate.email,
        amountPaid: pendingCommission,
        newBalance: currentBalance + pendingCommission
      }
    })
  } catch (error) {
    console.error('❌ ERROR DETAIL:', error)
    console.error('   Error type:', error?.constructor?.name)
    console.error('   Error message:', error instanceof Error ? error.message : String(error))
    console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json(
      {
        error: 'Failed to mark commission as paid',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
