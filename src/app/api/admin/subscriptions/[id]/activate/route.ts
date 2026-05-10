import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { sendTelegramNotification } from '@/lib/telegram'

// Commission rate: 30% of Rp 49,000 = Rp 14,700
const COMMISSION_PER_PRO = 14700

// POST activate a subscription
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { endDate, paymentMethod, adminNote } = body

    // Get current subscription
    const subscription = await db.userSubscription.findUnique({
      where: { id },
      include: { plan: true }
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    if (subscription.isActive) {
      return NextResponse.json(
        { error: 'Subscription is already active' },
        { status: 400 }
      )
    }

    // Activate subscription in Prisma
    const updatedSubscription = await db.userSubscription.update({
      where: { id },
      data: {
        isActive: true,
        paymentStatus: 'completed',
        endDate: endDate ? new Date(endDate) : null,
        amountPaid: subscription.plan.price,
        paymentMethod: paymentMethod || 'manual',
        adminNote: adminNote || 'Activated by admin'
      }
    })

    // Update slot tracking if plan has max slots
    if (subscription.plan.maxSlots) {
      const slotTracking = await db.slotTracking.findUnique({
        where: { planId: subscription.planId }
      })

      if (slotTracking) {
        await db.slotTracking.update({
          where: { id: slotTracking.id },
          data: { usedSlots: slotTracking.usedSlots + 1 }
        })
      }
    }

    // ============================================
    // UPDATE SUPABASE PROFILES TABLE
    // ============================================
    const subscriptionDuration = subscription.plan.durationMonths
    const isLifetime = subscription.plan.isLifetime
    
    // Calculate subscription end date
    let subscriptionUntil: string | null = null
    if (isLifetime) {
      // Lifetime - set far future date (10 years)
      subscriptionUntil = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
    } else if (subscriptionDuration && subscriptionDuration > 0) {
      // Monthly/Yearly plan - calculate end date
      const endDateObj = new Date()
      endDateObj.setMonth(endDateObj.getMonth() + subscriptionDuration)
      subscriptionUntil = endDateObj.toISOString()
    }

    // Update Supabase profiles table
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'PRO',
        is_pro: true,
        subscription_until: subscriptionUntil,
        pro_status: 'active',
        pro_expiry_date: subscriptionUntil,
        updated_at: new Date().toISOString()
      })
      .eq('email', subscription.userEmail)

    if (profileUpdateError) {
      console.error('❌ Failed to update Supabase profile:', profileUpdateError)
    } else {
      console.log('✅ Supabase profile updated to PRO for:', subscription.userEmail)
    }

    // ============================================
    // COMMISSION: Update referrer's balance
    // ============================================
    try {
      // Get user's profile to find referrer
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('referred_by_code, my_referral_code, full_name, email')
        .eq('email', subscription.userEmail)
        .single()

      if (userProfile?.referred_by_code) {
        // Find referrer in Prisma
        const referrer = await db.affiliateProfile.findUnique({
          where: { myReferralCode: userProfile.referred_by_code }
        })

        if (referrer) {
          // Update referrer's balance and commission
          await db.affiliateProfile.update({
            where: { userId: referrer.userId },
            data: {
              affiliateBalance: { increment: COMMISSION_PER_PRO },
              totalCommission: { increment: COMMISSION_PER_PRO },
              totalReferrals: { increment: 1 }
            }
          })

          console.log('✅ Commission added to referrer:', referrer.email, 'Amount: Rp', COMMISSION_PER_PRO)

          // Update referrer's Supabase profile
          await supabase
            .from('profiles')
            .update({
              affiliate_balance: (referrer.affiliateBalance || 0) + COMMISSION_PER_PRO,
              referral_count: { increment: 1 },
              updated_at: new Date().toISOString()
            })
            .eq('email', referrer.email)

          // Update referral_tracking status to 'paid'
          const { data: trackingRecord } = await supabase
            .from('referral_tracking')
            .select('id')
            .eq('referee_id', subscription.userId || userProfile.email)
            .eq('referral_code_used', userProfile.referred_by_code)
            .single()

          if (trackingRecord) {
            await supabase
              .from('referral_tracking')
              .update({
                status: 'paid',
                commission_amount: COMMISSION_PER_PRO,
                updated_at: new Date().toISOString()
              })
              .eq('id', trackingRecord.id)
          }

          // Send Telegram notification to referrer
          try {
            const msg = `💰 <b>KOMISI DITERIMA!</b>\n\n🎯 Referal: ${userProfile.full_name || userProfile.email}\n💎 Upgrade ke: ${subscription.plan.name}\n💰 Komisi: Rp${COMMISSION_PER_PRO.toLocaleString('id-ID')}\n\nSaldo total: Rp${(referrer.affiliateBalance + COMMISSION_PER_PRO).toLocaleString('id-ID')}`
            await sendTelegramNotification(msg)
          } catch (e) {
            console.error('Failed to send Telegram notification:', e)
          }
        }
      }
    } catch (commissionError) {
      console.error('❌ Commission update error (non-blocking):', commissionError)
      // Don't fail activation if commission fails
    }

    return NextResponse.json({
      subscription: updatedSubscription,
      message: 'Subscription activated successfully',
      commissionPaid: COMMISSION_PER_PRO
    })
  } catch (error) {
    console.error('Error activating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to activate subscription', details: String(error) },
      { status: 500 }
    )
  }
}
