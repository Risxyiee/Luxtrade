import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

// Max 2 times user can change their referral code
const MAX_CODE_CHANGES = 2

// GET - Get user's referral info
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's profile with referral info
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('my_referral_code, affiliate_balance, referral_code_changes, referred_by_code')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const changesMade = profile.referral_code_changes || 0
    const changesLeft = MAX_CODE_CHANGES - changesMade

    return NextResponse.json({
      referralCode: profile.my_referral_code,
      affiliateBalance: profile.affiliate_balance || 0,
      referralCodeChanges: changesMade,
      changesLeft,
      canChangeCode: changesLeft > 0,
      maxChanges: MAX_CODE_CHANGES,
      referredByCode: profile.referred_by_code,
    })
  } catch (error) {
    console.error('Referral API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Change referral code (max 2 times)
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { newCode } = body

    // Validate new code
    if (!newCode || newCode.length < 4 || newCode.length > 15) {
      return NextResponse.json({ 
        error: 'Kode referral harus 4-15 karakter' 
      }, { status: 400 })
    }

    // Only allow alphanumeric
    const validCode = /^[A-Z0-9]+$/i
    if (!validCode.test(newCode)) {
      return NextResponse.json({ 
        error: 'Kode referral hanya boleh huruf dan angka' 
      }, { status: 400 })
    }

    // Get current profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('referral_code_changes, my_referral_code')
      .eq('id', user.id)
      .single()

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if already changed MAX times
    const currentChanges = profile.referral_code_changes || 0
    if (currentChanges >= MAX_CODE_CHANGES) {
      return NextResponse.json({ 
        error: `Kode referral sudah diubah ${MAX_CODE_CHANGES} kali. Tidak bisa diubah lagi.` 
      }, { status: 400 })
    }

    const upperCode = newCode.toUpperCase()

    // Don't allow same code
    if (upperCode === profile.my_referral_code) {
      return NextResponse.json({ 
        error: 'Kode baru harus berbeda dari kode sekarang' 
      }, { status: 400 })
    }

    // Check if code already exists in Supabase
    const { data: existingCode } = await supabase
      .from('profiles')
      .select('id')
      .eq('my_referral_code', upperCode)
      .single()

    if (existingCode) {
      return NextResponse.json({ 
        error: 'Kode referral sudah digunakan orang lain' 
      }, { status: 400 })
    }

    // Check if code exists in Prisma
    const existingPrisma = await db.affiliateProfile.findUnique({
      where: { myReferralCode: upperCode },
    })
    if (existingPrisma) {
      return NextResponse.json({ 
        error: 'Kode referral sudah digunakan orang lain' 
      }, { status: 400 })
    }

    // Update in Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        my_referral_code: upperCode,
        referral_code_changes: currentChanges + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating referral code in Supabase:', updateError)
      return NextResponse.json({ error: 'Gagal mengubah kode referral' }, { status: 500 })
    }

    // Also update in Prisma AffiliateProfile
    try {
      const prismaAffiliate = await db.affiliateProfile.findUnique({
        where: { userId: user.id },
      })
      if (prismaAffiliate) {
        await db.affiliateProfile.update({
          where: { userId: user.id },
          data: { myReferralCode: upperCode },
        })
      }
    } catch (e) {
      console.error('Error syncing referral code to Prisma:', e)
    }

    const remaining = MAX_CODE_CHANGES - (currentChanges + 1)

    return NextResponse.json({
      success: true,
      message: remaining > 0 
        ? `Kode referral berhasil diubah! Sisa ${remaining}x perubahan.` 
        : 'Kode referral berhasil diubah! Ini perubahan terakhir.',
      newCode: upperCode,
      changesLeft: remaining,
    })
  } catch (error) {
    console.error('Referral update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
