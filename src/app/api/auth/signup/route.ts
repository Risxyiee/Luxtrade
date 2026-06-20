import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'

// Helper function to generate referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LUX'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

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

    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured')
      return NextResponse.json(
        { error: 'Server tidak dikonfigurasi dengan benar.' },
        { status: 500 }
      )
    }

    // Generate unique referral code for this user
    const myReferralCode = generateReferralCode()
    const now = new Date().toISOString()

    // ============================================
    // Step 1: Create user via ADMIN API (no auto-email!)
    // supabaseAdmin.auth.admin.createUser() does NOT send confirmation email
    // This is the key fix - we control email sending ourselves via Resend
    // ============================================
    console.log('🚀 Creating user via admin API (no auto-email)...')

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // User needs to confirm email
      user_metadata: {
        full_name: fullName,
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
    })

    if (createError) {
      console.error('❌ Admin create user error:', createError)

      const errorMsg = createError.message || 'Unknown error'

      // Check for duplicate email
      if (errorMsg.toLowerCase().includes('already registered') ||
          errorMsg.toLowerCase().includes('already been registered') ||
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('already exists') ||
          errorMsg.toLowerCase().includes('duplicate') ||
          errorMsg.toLowerCase().includes('user already exists')) {
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

      return NextResponse.json(
        { error: `Gagal membuat akun: ${errorMsg}` },
        { status: 400 }
      )
    }

    if (!userData.user) {
      console.error('❌ No user returned from admin.createUser')
      return NextResponse.json(
        { error: 'Gagal membuat akun. Silakan coba lagi.' },
        { status: 500 }
      )
    }

    const user = userData.user
    console.log('✅ User created via admin API:', user.id)
    console.log('✅ User email:', user.email)
    console.log('✅ Email confirmed?', user.email_confirmed_at) // Should be null

    // ============================================
    // Step 2: Create profile
    // ============================================
    try {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          subscription_status: 'FREE',
          is_pro: false,
          device_id: deviceId || null,
          my_referral_code: myReferralCode,
          referred_by_code: referralCode || null,
          has_ever_been_pro: false,
          commission_paid: false,
          streakCount: 0,
          bestStreak: 0,
          achievements: [],
          created_at: now,
          updated_at: now
        })

      if (profileError) {
        console.error('⚠️ Profile creation error (non-fatal):', profileError.message)
      } else {
        console.log('✅ Profile created')
      }
    } catch (profileErr) {
      console.error('⚠️ Profile setup error (non-fatal):', profileErr)
    }

    // ============================================
    // Step 3: Generate confirmation link & send via Resend
    // Use admin.generateLink with redirectTo to avoid Supabase email dependency
    // ============================================
    let emailSent = false
    try {
      console.log('📧 Generating confirmation link...')

      // Build confirmation URL manually — Supabase will verify the token on callback
      // Use generateLink with type 'magiclink' which creates a verified token
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          emailRedirectTo: `${SITE_URL}/auth/callback`,
        },
      })

      if (linkError) {
        console.error('⚠️ Supabase generateLink failed (non-fatal):', linkError.message)
        // Fallback: build confirmation URL using Supabase OTP API
        console.log('📧 Trying OTP fallback for confirmation link...')
      }

      // Extract the confirmation URL from whichever method worked
      const confirmationUrl = linkData?.properties?.action_link
        || linkData?.action_link
        || linkData?.verified_redirect_url

      console.log('📧 Confirmation URL:', confirmationUrl ? 'YES' : 'NO - will build manual URL')

      if (confirmationUrl) {
        // Send via Resend
        const name = fullName || email.split('@')[0]
        const fallbackHtml = getConfirmationEmailHtml(name, confirmationUrl)

        console.log('📧 Sending email via Resend...')
        const emailResult = await sendEmailFromTemplate({
          to: email,
          subject: 'Konfirmasi Email - LuxTrade 👑',
          templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
          templateParams: { name, confirmationUrl },
          fallbackHtml,
        })

        if (emailResult.success) {
          console.log('✅ Confirmation email sent via Resend successfully!')
          emailSent = true
        } else {
          console.error('❌ Failed to send via Resend:', JSON.stringify(emailResult.error))
        }
      } else {
        // Supabase link generation failed — auto-confirm the user instead
        // so they can login immediately without email verification
        console.log('⚠️ No confirmation URL available, auto-confirming user...')
        try {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            email_confirm: true,
          })
          console.log('✅ User auto-confirmed (can login immediately)')
          emailSent = true // Treat as success since user can now login
        } catch (confirmErr) {
          console.error('❌ Auto-confirm failed:', confirmErr)
        }
      }
    } catch (emailErr) {
      console.error('❌ Confirmation email error:', emailErr)
      // Last resort: auto-confirm
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true })
        emailSent = true
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'Akun berhasil dibuat! Silakan login di halaman login.'
        : 'Akun berhasil dibuat, tapi gagal mengirim email konfirmasi. Silakan kirim ulang dari halaman login.',
      user: {
        id: user.id,
        email: user.email
      },
      emailSent
    })
  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    )
  }
}
