import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { sendTelegramNotification } from '@/lib/telegram'

// Commission rate: 30% of Rp 49,000 = Rp 14,700
const COMMISSION_PER_PRO = 14700
const WITHDRAWAL_MIN = 50000

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'LUX'
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get profile from Supabase
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get or create affiliate profile from Prisma
    let affiliate = await db.affiliateProfile.findUnique({
      where: { userId },
    })

    // If no affiliate profile exists, create one
    if (!affiliate) {
      const referralCode = profile.my_referral_code || generateReferralCode()

      affiliate = await db.affiliateProfile.create({
        data: {
          userId,
          email: profile.email || '',
          fullName: profile.full_name || null,
          myReferralCode: referralCode,
          referredByCode: profile.referred_by_code || null,
          affiliateBalance: profile.affiliate_balance || 0,
          totalReferrals: 0,
          totalCommission: 0,
        },
      })

      // Update Supabase profile with referral code if not set
      if (!profile.my_referral_code) {
        await supabase
          .from('profiles')
          .update({ my_referral_code: referralCode })
          .eq('id', userId)
      }
    }

    // Get withdrawals for this user
    const withdrawals = await db.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Get referrals (users who used this person's code)
    const referrals = await db.affiliateProfile.findMany({
      where: { referredByCode: affiliate.myReferralCode },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    return NextResponse.json({
      success: true,
      affiliate: {
        ...affiliate,
        referralLink: `${baseUrl}/auth/signup?ref=${affiliate.myReferralCode}`,
        commissionRate: '30%',
        commissionPerPro: COMMISSION_PER_PRO,
        withdrawalMin: WITHDRAWAL_MIN,
        totalReferralsCount: referrals.length,
      },
      referrals,
      withdrawals,
    })
  } catch (error) {
    console.error('Affiliate GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, fullName, referralCode, deviceId } = body

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if affiliate profile already exists
    const existing = await db.affiliateProfile.findUnique({
      where: { userId },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        affiliate: existing,
        alreadyExists: true,
      })
    }

    // Generate referral code
    const myCode = generateReferralCode()

    // Create affiliate profile
    const affiliate = await db.affiliateProfile.create({
      data: {
        userId,
        email,
        fullName: fullName || null,
        myReferralCode: myCode,
        referredByCode: referralCode || null,
        affiliateBalance: 0,
        totalReferrals: 0,
        totalCommission: 0,
      },
    })

    // If referred by someone, notify the referrer via Telegram
    if (referralCode) {
      const referrer = await db.affiliateProfile.findUnique({
        where: { myReferralCode: referralCode },
      })

      if (referrer) {
        // Increment referral count
        await db.affiliateProfile.update({
          where: { userId: referrer.userId },
          data: { totalReferrals: { increment: 1 } },
        })

        // Notify referrer via Telegram
        try {
          const { sendTelegramNotification } = await import('@/lib/telegram')
          const msg = `🎉 <b>REFERRAL BARU!</b>\n\n👤 Referrer: ${referrer.fullName || referrer.email}\n📧 Downline: ${fullName || email}\n🏷️ Kode: <code>${referralCode}</code>\n\n⏰ ${new Date().toLocaleString('id-ID')}`
          await sendTelegramNotification(msg)
        } catch (e) {
          console.error('Failed to send Telegram notification:', e)
        }
      }
    }

    return NextResponse.json({
      success: true,
      affiliate,
      alreadyExists: false,
    })
  } catch (error) {
    console.error('Affiliate POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
