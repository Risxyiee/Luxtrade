import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthenticatedUser } from '@/lib/api-auth'

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LUX'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function generateUniqueReferralCode(admin: ReturnType<typeof getSupabaseAdmin> & NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<string> {
  let code = generateReferralCode()
  const { data: existing } = await admin.from('affiliates').select('id').eq('referral_code', code).maybeSingle()
  let attempts = 0
  while (existing && attempts < 10) {
    code = generateReferralCode()
    const { data: ex } = await admin.from('affiliates').select('id').eq('referral_code', code).maybeSingle()
    if (!ex) break
    attempts++
  }
  return code
}

// GET /api/affiliate/me - Get current user's affiliate data
export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find or create affiliate record
    const { data: affiliate } = await admin.from('affiliates').select('*').eq('user_id', authUser.id).maybeSingle()

    let finalAffiliate = affiliate

    if (!finalAffiliate) {
      const referralCode = await generateUniqueReferralCode(admin)
      // ⚠️ Kolom saldo = current_balance (kolom `balance` TIDAK ADA — probe
      // produksi 42703). Dulu insert pakai `balance: 0` → selalu gagal →
      // user baru PASTI kena 500 di halaman affiliate.
      const { data: created, error: createErr } = await admin.from('affiliates').insert({
        user_id: authUser.id,
        referral_code: referralCode,
        total_earned: 0,
        total_withdrawn: 0,
        current_balance: 0,
      }).select().single()
      if (createErr || !created) {
        console.error('Failed to create affiliate record:', createErr)
        return NextResponse.json({ error: 'Gagal menyiapkan akun affiliate, coba lagi' }, { status: 500 })
      }
      finalAffiliate = created
    }

    // If for some reason the affiliate has no referral code, generate one
    if (!finalAffiliate?.referral_code) {
      const referralCode = await generateUniqueReferralCode(admin)
      const { data: updated } = await admin.from('affiliates').update({ referral_code: referralCode }).eq('id', finalAffiliate!.id).select().single()
      finalAffiliate = updated
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'
    const referralLink = `${baseUrl}?ref=${finalAffiliate!.referral_code}`

    return NextResponse.json({
      referralCode: finalAffiliate!.referral_code,
      totalEarned: finalAffiliate!.total_earned ?? 0,
      // total_paid di-increment admin saat mark PAID; total_withdrawn = fallback
      totalPaid: finalAffiliate!.total_paid ?? finalAffiliate!.total_withdrawn ?? 0,
      // ⚠️ Saldo dibaca dari current_balance (bukan `balance` yang tak ada)
      currentBalance: finalAffiliate!.current_balance ?? 0,
      referralLink,
    })
  } catch (error) {
    console.error('Affiliate me GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}