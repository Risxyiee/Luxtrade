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

    // ============================================
    // Step 1: Pre-flight check - verify profiles table exists
    // ============================================
    try {
      const { error: tableCheck } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)

      if (tableCheck) {
        const msg = tableCheck.message || String(tableCheck)
        if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
          console.error('❌ Profiles table does not exist!')
          return NextResponse.json(
            {
              error: 'Database belum di-setup. Silakan jalankan setup terlebih dahulu.',
              code: 'DB_NOT_SETUP',
              needsSetup: true
            },
            { status: 503 }
          )
        }
      }
    } catch (checkErr) {
      console.warn('⚠️ Could not verify profiles table:', checkErr)
      // Continue anyway - might be a network issue
    }

    // ============================================
    // Step 2: Sign up user with Supabase Auth
    // ============================================
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

      // Parse common errors and provide helpful messages
      const errorMsg = signUpError.message || 'Unknown error'

      // Check for database-related errors
      if (errorMsg.toLowerCase().includes('database') || 
          errorMsg.toLowerCase().includes('saving new user') ||
          errorMsg.toLowerCase().includes('relation') ||
          errorMsg.toLowerCase().includes('does not exist') ||
          errorMsg.toLowerCase().includes('trigger')) {
        return NextResponse.json(
          {
            error: 'Database error. Tabel profiles belum dibuat di Supabase. Jalankan setup database terlebih dahulu di /api/setup',
            code: 'DB_ERROR',
            originalError: errorMsg,
            needsSetup: true
          },
          { status: 503 }
        )
      }

      // Check for duplicate email
      if (errorMsg.toLowerCase().includes('already registered') || 
          errorMsg.toLowerCase().includes('already been registered') ||
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('duplicate') ||
          errorMsg.toLowerCase().includes('already exists')) {
        return NextResponse.json(
          { error: 'Email sudah terdaftar. Silakan login atau gunakan email lain.' },
          { status: 409 }
        )
      }

      // Check for rate limiting
      if (errorMsg.toLowerCase().includes('rate limit') || 
          errorMsg.toLowerCase().includes('too many') ||
          errorMsg.toLowerCase().includes('security')) {
        return NextResponse.json(
          { error: 'Terlalu banyak percobaan. Tunggu beberapa menit dan coba lagi.' },
          { status: 429 }
        )
      }

      // Generic Supabase error
      return NextResponse.json(
        { error: `Gagal membuat akun: ${errorMsg}` },
        { status: 400 }
      )
    }

    // ============================================
    // Step 3: User created in auth - now handle profile & referral
    // ============================================
    if (!data.user) {
      console.error('❌ No user returned from signUp')
      return NextResponse.json(
        { error: 'Gagal membuat akun. Silakan coba lagi.' },
        { status: 500 }
      )
    }

    console.log('✅ User created:', data.user.id)
    console.log('✅ User email:', data.user.email)

    // Generate unique referral code for this user
    let myReferralCode = generateReferralCode()
    let attempts = 0
    while (attempts < 10) {
      try {
        const { data: existingCode } = await supabase
          .from('profiles')
          .select('my_referral_code')
          .eq('my_referral_code', myReferralCode)
          .single()

        if (!existingCode) break
        myReferralCode = generateReferralCode()
        attempts++
      } catch {
        // Table might not exist - break and use the code
        break
      }
    }

    // ============================================
    // ANTI-FRAUD CHECK: Validate referral code if provided
    // ============================================
    let referralStatus = 'none'
    let fraudReason: string | null = null
    let referrerId: string | null = null

    if (referralCode) {
      try {
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
      } catch (refErr) {
        console.warn('⚠️ Could not validate referral code:', refErr)
        // Don't fail signup because of referral validation issues
      }
    }

    // ============================================
    // Step 4: Try to create/update profile (non-blocking)
    // ============================================
    try {
      // First try to update (in case trigger already created a basic profile)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          email: data.user.email,
          full_name: fullName,
          subscription_status: 'FREE',
          is_pro: false,
          device_id: deviceId || null,
          my_referral_code: myReferralCode,
          referred_by_code: referralCode ? referralCode.toUpperCase() : null,
          affiliate_balance: 0,
          referral_code_changes: 0,
          referral_status: referralStatus,
          has_ever_been_pro: false,
          commission_paid: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.user.id)

      if (!updateError) {
        console.log('✅ Profile updated with referral code:', myReferralCode)
      } else {
        // If update failed, try insert
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            subscription_status: 'FREE',
            is_pro: false,
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

        if (insertError) {
          console.error('⚠️ Profile creation error:', insertError.message)
          // Don't fail signup - user was created in auth
        } else {
          console.log('✅ Profile created with referral code:', myReferralCode)
        }
      }

      // ============================================
      // Create referral tracking record if code was used
      // ============================================
      if (referralCode && referrerId) {
        try {
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
            console.error('⚠️ Referral tracking error:', trackingError.message)
          } else {
            console.log('✅ Referral tracking created')
          }
        } catch (trackErr) {
          console.warn('⚠️ Could not create referral tracking:', trackErr)
        }
      }
    } catch (profileErr) {
      console.error('⚠️ Profile setup error (non-fatal):', profileErr)
      // User was already created in auth, so signup is still successful
    }

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil dibuat! Cek email untuk konfirmasi.',
      user: {
        id: data.user.id,
        email: data.user.email,
        referralCode: myReferralCode
      }
    })

  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    )
  }
}
