export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// Rate limit: 1 change per 30 days per user
// We store the last change timestamp in the affiliate record
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const CODE_REGEX = /^[A-Z0-9]{4,20}$/

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { newCode } = body as { newCode?: string }

    if (!newCode || typeof newCode !== 'string') {
      return NextResponse.json({ error: 'Kode referral baru wajib diisi' }, { status: 400 })
    }

    const code = newCode.toUpperCase().trim()

    // Validation: only letters and numbers, 4-20 chars
    if (!CODE_REGEX.test(code)) {
      return NextResponse.json(
        { error: 'Kode hanya boleh huruf dan angka, panjang 4-20 karakter' },
        { status: 400 }
      )
    }

    // Find affiliate for this user
    const affiliate = await db.affiliate.findUnique({
      where: { userId: authUser.id },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate record tidak ditemukan' }, { status: 404 })
    }

    // Rate limit check: 1 change per 30 days
    if (affiliate.codeChangedAt) {
      const elapsed = Date.now() - new Date(affiliate.codeChangedAt).getTime()
      if (elapsed < COOLDOWN_MS) {
        const daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000))
        return NextResponse.json(
          { error: `Kode referral hanya bisa diganti 1x per 30 hari. Coba lagi dalam ${daysLeft} hari.`, cooldownDaysLeft: daysLeft },
          { status: 429 }
        )
      }
    }

    // Can't set the same code
    if (code === affiliate.referralCode) {
      return NextResponse.json({ error: 'Kode baru tidak boleh sama dengan kode saat ini' }, { status: 400 })
    }

    // Uniqueness check
    const existing = await db.affiliate.findUnique({
      where: { referralCode: code },
    })
    if (existing) {
      return NextResponse.json({ error: 'Kode ini sudah dipakai, coba yang lain' }, { status: 409 })
    }

    // Update the code — referrals are linked via affiliate_id, not the code, so existing referrals are safe
    await db.affiliate.update({
      where: { id: affiliate.id },
      data: {
        referralCode: code,
        codeChangedAt: new Date(),
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
    const newReferralLink = `${baseUrl}?ref=${code}`

    return NextResponse.json({
      success: true,
      message: 'Kode referral berhasil diubah!',
      referralCode: code,
      referralLink: newReferralLink,
    })
  } catch (error) {
    console.error('Affiliate update-code PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}