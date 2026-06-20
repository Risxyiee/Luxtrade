import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { db } from '@/lib/db'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'
import crypto from 'crypto'

// Helper function to generate referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LUX'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Generate secure verification token
function generateVerifyToken(): string {
  return crypto.randomBytes(32).toString('hex')
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
    // ============================================
    console.log('🚀 Creating user via admin API...')

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // User MUST confirm email
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
    console.log('✅ User created:', user.id)

    // ============================================
    // Step 2: Create profile with verification token
    // ============================================
    const verifyToken = generateVerifyToken()
    const verifyExpAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    try {
      await db.profile.create({
        data: {
          id: user.id,
          email: user.email,
          full_name: fullName,
          subscription_status: 'FREE',
          is_pro: false,
          emailVerified: false,
          emailVerifyToken: verifyToken,
          emailVerifyExpAt: verifyExpAt,
          device_id: deviceId || null,
          my_referral_code: myReferralCode,
          referred_by_code: referralCode || null,
          has_ever_been_pro: false,
          commission_paid: false,
          streakCount: 0,
          bestStreak: 0,
          achievements: [],
          created_at: new Date(now),
          updated_at: new Date(now)
        }
      })
      console.log('✅ Profile created with verification token')
    } catch (profileErr: any) {
      // Profile might already exist, try update with token
      if (profileErr.code === 'P2002') {
        await db.profile.update({
          where: { id: user.id },
          data: {
            emailVerified: false,
            emailVerifyToken: verifyToken,
            emailVerifyExpAt: verifyExpAt,
          }
        })
        console.log('✅ Profile updated with verification token')
      } else {
        console.error('⚠️ Profile creation error (non-fatal):', profileErr)
      }
    }

    // ============================================
    // Step 3: Send confirmation email via Resend ONLY
    // No dependency on Supabase email service
    // ============================================
    let emailSent = false
    const confirmationUrl = `${SITE_URL}/auth/verify?token=${verifyToken}`
    const name = fullName || email.split('@')[0]

    try {
      console.log('📧 Sending confirmation email via Resend...')
      const fallbackHtml = getConfirmationEmailHtml(name, confirmationUrl)

      const emailResult = await sendEmailFromTemplate({
        to: email,
        subject: 'Konfirmasi Email - LuxTrade 👑',
        templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
        templateParams: { name, confirmationUrl },
        fallbackHtml,
      })

      if (emailResult.success) {
        console.log('✅ Confirmation email sent via Resend!')
        emailSent = true
      } else {
        console.error('❌ Resend failed:', JSON.stringify(emailResult.error))
      }
    } catch (emailErr) {
      console.error('❌ Email send error:', emailErr)
    }

    // Also try to create profile in Supabase profiles table
    try {
      await supabaseAdmin.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        subscription_status: 'FREE',
        is_pro: false,
        email_verified: false,
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
    } catch {}

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'Akun berhasil dibuat! Cek email untuk verifikasi.'
        : 'Akun berhasil dibuat, tapi gagal mengirim email verifikasi. Hubungi admin.',
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
