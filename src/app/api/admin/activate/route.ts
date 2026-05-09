import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { notifyCommissionEarned } from '@/lib/telegram'

// Admin email - only this email can access admin panel
const ADMIN_EMAIL = 'luxtradee@gmail.com'

// Commission: 30% of Rp 49,000 = Rp 14,700
const COMMISSION_PER_PRO = 14700

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminEmail, userId, months } = body

    // Verify admin access
    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access only.' },
        { status: 403 }
      )
    }

    if (!userId || !months) {
      return NextResponse.json(
        { error: 'Missing userId or months parameter' },
        { status: 400 }
      )
    }

    // Calculate expiry date
    const expiryDate = new Date()
    expiryDate.setMonth(expiryDate.getMonth() + months)

    // Update user profile
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'PRO',
        pro_status: 'active',
        pro_expiry_date: expiryDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      console.error('Error activating PRO:', error)
      return NextResponse.json(
        { error: 'Failed to activate PRO status' },
        { status: 500 }
      )
    }

    // ====== AFFILIATE COMMISSION LOGIC ======
    // When admin activates PRO, give commission to the referrer
    try {
      // Get the user's affiliate profile to find who referred them
      const affiliate = await db.affiliateProfile.findUnique({
        where: { userId },
      })

      if (affiliate && affiliate.referredByCode) {
        // Find the referrer
        const referrer = await db.affiliateProfile.findUnique({
          where: { myReferralCode: affiliate.referredByCode },
        })

        if (referrer) {
          const commission = COMMISSION_PER_PRO

          // Add commission to referrer's balance
          await db.affiliateProfile.update({
            where: { userId: referrer.userId },
            data: {
              affiliateBalance: { increment: commission },
              totalCommission: { increment: commission },
            },
          })

          // Also update Supabase profiles table
          const currentBalance = referrer.affiliateBalance + commission
          await supabase
            .from('profiles')
            .update({ affiliate_balance: currentBalance })
            .eq('id', referrer.userId)

          // Send Telegram notification
          await notifyCommissionEarned(
            referrer.fullName || referrer.email,
            affiliate.email || 'User',
            commission
          )
        }
      }
    } catch (affError) {
      console.error('Affiliate commission error (non-blocking):', affError)
    }

    return NextResponse.json({
      success: true,
      message: `PRO activated for ${months} month(s)`,
      expiryDate: expiryDate.toISOString(),
    })
  } catch (error) {
    console.error('Activate API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Deactivate PRO status
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminEmail = searchParams.get('adminEmail')
    const userId = searchParams.get('userId')

    // Verify admin access
    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access only.' },
        { status: 403 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    // Update user profile to free
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'FREE',
        pro_status: 'inactive',
        pro_expiry_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      console.error('Error deactivating PRO:', error)
      return NextResponse.json(
        { error: 'Failed to deactivate PRO status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'PRO status deactivated',
    })
  } catch (error) {
    console.error('Deactivate API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
