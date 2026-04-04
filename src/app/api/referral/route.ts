import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ============================================
// REFERRAL API - For users to manage their referral codes
// ============================================

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

    // Get referral stats
    const { data: referrals } = await supabase
      .from('referral_tracking')
      .select('id, status, commission_amount, created_at')
      .eq('referrer_id', user.id)

    const stats = {
      totalReferrals: referrals?.length || 0,
      validReferrals: referrals?.filter(r => r.status === 'commissioned').length || 0,
      pendingReferrals: referrals?.filter(r => r.status === 'pending').length || 0,
      fraudReferrals: referrals?.filter(r => r.status === 'fraud').length || 0,
      totalEarnings: referrals?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0
    }

    // Get referrer info if user was referred
    let referrer = null
    if (profile.referred_by_code) {
      const { data: referrerData } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('my_referral_code', profile.referred_by_code)
        .single()
      
      if (referrerData) {
        referrer = { email: referrerData.email, name: referrerData.full_name }
      }
    }

    return NextResponse.json({
      referralCode: profile.my_referral_code,
      affiliateBalance: profile.affiliate_balance || 0,
      referralCodeChanges: profile.referral_code_changes || 0,
      canChangeCode: (profile.referral_code_changes || 0) < 1,
      stats,
      referredByCode: profile.referred_by_code,
      referrer
    })
  } catch (error) {
    console.error('Referral API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Change referral code (max 1 time)
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
    if (!newCode || newCode.length < 5 || newCode.length > 15) {
      return NextResponse.json({ 
        error: 'Kode referral harus 5-15 karakter' 
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
      .select('referral_code_changes')
      .eq('id', user.id)
      .single()

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if already changed once
    if ((profile.referral_code_changes || 0) >= 1) {
      return NextResponse.json({ 
        error: 'Kode referral hanya bisa diubah 1 kali' 
      }, { status: 400 })
    }

    // Check if code already exists
    const { data: existingCode } = await supabase
      .from('profiles')
      .select('id')
      .eq('my_referral_code', newCode.toUpperCase())
      .single()

    if (existingCode) {
      return NextResponse.json({ 
        error: 'Kode referral sudah digunakan' 
      }, { status: 400 })
    }

    // Update code
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        my_referral_code: newCode.toUpperCase(),
        referral_code_changes: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating referral code:', updateError)
      return NextResponse.json({ error: 'Gagal mengubah kode referral' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Kode referral berhasil diubah!',
      newCode: newCode.toUpperCase()
    })
  } catch (error) {
    console.error('Referral update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
