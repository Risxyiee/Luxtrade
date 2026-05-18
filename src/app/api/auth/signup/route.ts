import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Helper function to generate referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LUX'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, deviceId, referralCode } = await request.json()
    console.log('📝 Signup request for:', email)

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
    // NOTE: Database setup check is now non-blocking
    // If tables don't exist, they will be created automatically by trigger
    let tableExists = true
    try {
      const { error: tableCheck } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single()

      const msg = tableCheck ? String(tableCheck) : ''
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
        console.warn('⚠️ Profiles table does not exist - signup will continue anyway')
        tableExists = false
      }
    } catch (checkErr) {
      console.warn('⚠️ Could not verify profiles table:', checkErr)
      tableExists = false
    }

    // ============================================
    // Step 2: Sign up user with Supabase Auth
    // ============================================
    console.log('🚀 Calling supabase.auth.signUp...')

    // Generate unique referral code for this user
    const myReferralCode = generateReferralCode()
    const now = new Date().toISOString()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          // Auto-init user metadata for admin panel
          is_pro: false,
          subscription_status: 'inactive',
          subscription_until: null,
          my_referral_code: myReferralCode,
          referred_by_code: referralCode || null,
          has_ever_been_pro: false,
          commission_paid: false,
          device_id: deviceId || null,
          created_at: now,
          updated_at: now,
          role: 'member'
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://d18td1p2anb1-d.space.z.ai'}/auth/callback`,
      },
    })

    if (signUpError) {
      console.error('❌ Supabase signup error:', signUpError)

      // Parse common errors and provide helpful messages
      const errorMsg = signUpError.message || 'Unknown error'

      // Check for database-related errors - NON-BLOCKING
      if (errorMsg.toLowerCase().includes('database') ||
          errorMsg.toLowerCase().includes('saving new user') ||
          errorMsg.toLowerCase().includes('relation') ||
          errorMsg.toLowerCase().includes('does not exist') ||
          errorMsg.toLowerCase().includes('trigger')) {
        console.warn('⚠️ Database warning (non-blocking):', errorMsg)
        // Don't block signup - continue and try to handle profile creation later
      }

      // Check for duplicate email
      if (errorMsg.toLowerCase().includes('already registered') || 
          errorMsg.toLowerCase().includes('already been registered') ||
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('already exists') ||
          errorMsg.toLowerCase().includes('duplicate')) {
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
    // Step 3: User created in auth - now handle profile
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
          updated_at: new Date().toISOString()
        })
        .eq('id', data.user.id)

      if (!updateError) {
        console.log('✅ Profile updated')
      } else {
        // If update failed, try insert
        console.warn('⚠️ Profile update failed, trying insert...')
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            subscription_status: 'FREE',
            is_pro: false,
            device_id: deviceId || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (insertError) {
          console.error('⚠️ Profile creation error:', insertError.message)
          // Don't fail signup - user was already created in auth
        } else {
          console.log('✅ Profile created')
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
        email: data.user.email
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
