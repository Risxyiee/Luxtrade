import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ============================================
// AFFILIATE SYSTEM CONSTANTS
// ============================================
const COMMISSION_RATE = 0.30 // 30% commission
const PRO_PRICE = 49000 // Rp 49.000

// Generate unique referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LUX'
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, referralCode, deviceId } = await request.json()
    console.log('📝 Signup request for:', email, referralCode ? `(referral: ${referralCode})` : '')

    // Validate input
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Semua field harus diisi' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format email tidak valid' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password minimal 8 karakter' },
        { status: 400 }
      )
    }

    // Sign up user with Supabase Auth
    console.log('🚀 Calling supabase.auth.signUp...')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://d18td1p2anb1-d.space.z.ai'}/auth/callback`,
      },
    })

    if (signUpError) {
      console.error('❌ Supabase signup error:', signUpError)
      return NextResponse.json(
        { error: signUpError.message },
        { status: 400 }
      )
    }

    // User created successfully
    if (data.user) {
      console.log('✅ User created:', data.user.id)
      console.log('✅ User email:', data.user.email)
      
      // Generate unique referral code for this user
      let myReferralCode = generateReferralCode()
      
      // Ensure uniqueness
      let attempts = 0
      while (attempts < 10) {
        const { data: existingCode } = await supabase
          .from('profiles')
          .select('my_referral_code')
          .eq('my_referral_code', myReferralCode)
          .single()
        
        if (!existingCode) break
        myReferralCode = generateReferralCode()
        attempts++
      }

      // ============================================
      // ANTI-FRAUD CHECK: Validate referral code if provided
      // ============================================
      let referralStatus = 'none'
      let fraudReason = null
      let referrerId = null

      if (referralCode) {
        // Check if referral code exists
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id, device_id, my_referral_code')
          .eq('my_referral_code', referralCode.toUpperCase())
          .single()

        if (referrer) {
          referrerId = referrer.id
          
          // FRAUD CHECK 1: Self-referral (same device)
          if (deviceId && referrer.device_id === deviceId) {
            referralStatus = 'fraud'
            fraudReason = 'SELF_REFERRAL_SAME_DEVICE'
            console.log('⚠️ Fraud detected: Self-referral with same device')
          } else {
            // FRAUD CHECK 2: Device already used for commission
            if (deviceId) {
              const { data: deviceCheck } = await supabase
                .from('profiles')
                .select('id')
                .eq('device_id', deviceId)
                .eq('referral_status', 'valid')
                .limit(1)

              if (deviceCheck && deviceCheck.length > 0) {
                referralStatus = 'fraud'
                fraudReason = 'DEVICE_ALREADY_USED_FOR_COMMISSION'
                console.log('⚠️ Fraud detected: Device already earned commission')
              } else {
                referralStatus = 'pending'
                console.log('✅ Referral code valid, pending activation')
              }
            } else {
              referralStatus = 'pending'
            }
          }
        } else {
          console.log('⚠️ Invalid referral code provided:', referralCode)
        }
      }

      // Create profile in profiles table with affiliate columns
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          full_name: fullName,
          subscription_status: 'FREE',
          is_pro: false,
          // Affiliate columns
          device_id: deviceId || null,
          my_referral_code: myReferralCode,
          referred_by_code: referralCode ? referralCode.toUpperCase() : null,
          affiliate_balance: 0,
          referral_code_changes: 0,
          referral_status: referralStatus,
          has_ever_been_pro: false,
          commission_paid: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (profileError) {
        console.error('⚠️ Profile creation error:', profileError)
        // Don't fail signup if profile creation fails
      } else {
        console.log('✅ Profile created with referral code:', myReferralCode)
        
        // ============================================
        // Create referral tracking record if code was used
        // ============================================
        if (referralCode && referrerId) {
          const { error: trackingError } = await supabase
            .from('referral_tracking')
            .insert({
              referrer_id: referrerId,
              referee_id: data.user.id,
              referral_code_used: referralCode.toUpperCase(),
              device_id: deviceId || null,
              status: referralStatus === 'fraud' ? 'fraud' : 'pending',
              fraud_reason: fraudReason,
              commission_amount: 0,
              created_at: new Date().toISOString()
            })

          if (trackingError) {
            console.error('⚠️ Referral tracking error:', trackingError)
          } else {
            console.log('✅ Referral tracking created')
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Akun berhasil dibuat! Cek email untuk konfirmasi.',
        user: {
          id: data.user.id,
          email: data.user.email,
          referralCode: myReferralCode // Return user's own referral code
        }
      })
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan. Silakan coba lagi.' },
      { status: 500 }
    )
  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    )
  }
}
