import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getSupabaseAdminAuth } from '@/lib/supabase/admin'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'
import { edgeCrypto } from '@/lib/edge-crypto'

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LUX'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function generateVerifyToken(): string {
  return edgeCrypto.randomBytesHex(32)
}

const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
const VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

// ============================================
// Create profile using Supabase admin client
// ============================================
async function createOrUpdateProfile(admin: ReturnType<typeof getSupabaseAdmin> & {}, data: {
  id: string
  email: string
  full_name: string
  deviceId?: string | null
  myReferralCode: string
  referredByCode?: string | null
}): Promise<{ success: boolean; token: string }> {
  const token = generateVerifyToken()
  const expAt = new Date(Date.now() + VERIFY_EXPIRY_MS).toISOString()
  const now = new Date().toISOString()

  const profileData = {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    plan: 'FREE',
    is_pro: false,
    email_verified: false,
    email_verify_token: token,
    email_verify_exp_at: expAt,
    device_id: data.deviceId || null,
    my_referral_code: data.myReferralCode,
    referred_by_code: data.referredByCode || null,
    has_ever_been_pro: false,
    commission_paid: false,
    streak_count: 0,
    best_streak: 0,
    achievements: '[]',
    created_at: now,
    updated_at: now,
  }

  try {
    const { error } = await admin.from('profiles').upsert(profileData, { onConflict: 'id' })
    if (error) throw error
    console.log('✅ Profile created/updated via Supabase')
    return { success: true, token }
  } catch (err: any) {
    console.error('❌ Profile creation failed:', err.message)
    return { success: false, token: '' }
  }
}

// ============================================
// Main signup handler
// ============================================
export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Server tidak dikonfigurasi dengan benar.' }, { status: 500 })
    }

    const authAdmin = getSupabaseAdminAuth(admin as any)
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server tidak dikonfigurasi dengan benar.' }, { status: 500 })
    }

    // Rate limit: 5 signups per 15 minutes per IP
    const rl = checkRateLimit(request, 'signup', {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak percobaan daftar. Tunggu 15 menit.',
    })
    if (rl) return rl

    const { email, password, fullName, deviceId, referralCode } = await request.json()
    const emailLower = email?.toLowerCase()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Semua field harus diisi' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"|<>,.?\/~]/.test(password)) {
      return NextResponse.json({ error: 'Password wajib mengandung: huruf kecil, huruf besar, angka, dan simbol (contoh: !@#)' }, { status: 400 })
    }

    // ============================================
    // REFERRAL CODE VALIDATION (non-blocking)
    // ============================================
    let validatedReferralCode: string | null = null
    if (referralCode && typeof referralCode === 'string' && referralCode.trim().length > 0) {
      const normalizedCode = referralCode.trim().toUpperCase()
      try {
        const { data: affiliate, error: affErr } = await admin
          .from('affiliates')
          .select('referral_code, user_id')
          .eq('referral_code', normalizedCode)
          .single()

        if (affErr || !affiliate) {
          console.warn(`[signup] Referral code "${normalizedCode}" not found in affiliates table — saving anyway in referred_by_code`)
          validatedReferralCode = normalizedCode
        } else {
          console.log(`✅ [signup] Valid referral code "${normalizedCode}" from affiliate ${affiliate.user_id}`)
          validatedReferralCode = normalizedCode
        }
      } catch (refErr) {
        console.warn('[signup] Referral code validation failed (non-blocking):', refErr)
        validatedReferralCode = normalizedCode
      }
    }

    // ============================================
    // Step 0: Check if email already registered
    // ============================================
    try {
      const { data: ep, error: epErr } = await admin
        .from('profiles')
        .select('id, email, email_verified, full_name')
        .eq('email', emailLower)
        .limit(1)
        .single()

      if (ep && !epErr) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 Email already exists in profiles DB, verified:', ep.email_verified)
        }

        // Cek apakah user masih ada di Supabase Auth
        let userStillExists = false
        try {
          const { data: { users }, error: listErr } = await authAdmin.listUsers({
            page: 1, perPage: 1000
          })
          if (!listErr && users) {
            userStillExists = users.some((u: any) => u.email?.toLowerCase() === emailLower)
          }
        } catch (listErr) {
          console.warn('[signup] listUsers check failed:', listErr)
        }

        if (!userStillExists) {
          // User sudah dihapus dari Supabase Auth, tapi profil masih di DB
          console.log('🧹 User not in Auth, removing old profile for re-signup')
          try {
            await admin.from('profiles').delete().eq('id', ep.id)
            console.log('✅ Profil lama dihapus')
          } catch (delErr: any) {
            console.warn('⚠️ Gagal hapus profil lama:', delErr?.message?.slice(0, 80))
          }
        } else if (ep.email_verified) {
          return NextResponse.json(
            { error: 'Email sudah terdaftar dan terverifikasi. Langsung login aja!', code: 'ALREADY_VERIFIED' },
            { status: 409 }
          )
        } else {
          // User ada tapi belum verifikasi — kirim ulang email
          const newToken = generateVerifyToken()
          const newExpAt = new Date(Date.now() + VERIFY_EXPIRY_MS).toISOString()
          try {
            await admin.from('profiles').update({
              email_verify_token: newToken,
              email_verify_exp_at: newExpAt,
              updated_at: new Date().toISOString()
            }).eq('id', ep.id)
          } catch (tokenUpdateErr) {
            console.warn('[signup] Failed to update verify token for existing profile:', tokenUpdateErr)
          }

          const confirmationUrl = `${getSiteUrl()}/auth/verify?token=${newToken}`
          const name = ep.full_name || fullName || emailLower.split('@')[0]

          try {
            const fallbackHtml = getConfirmationEmailHtml(name, confirmationUrl)
            await sendEmailFromTemplate({
              to: emailLower, subject: 'Kirim Ulang: Verifikasi Akun LuxTrade 👑',
              templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
              templateParams: { name, confirmationUrl }, fallbackHtml,
            })
          } catch (resendErr) {
            console.warn('[signup] Failed to resend verification email:', resendErr)
          }

          return NextResponse.json({
            success: true, code: 'RESENT_VERIFICATION',
            message: 'Email sudah terdaftar tapi belum diverifikasi. Kami kirim ulang link verifikasi!',
          })
        }
      }
    } catch (checkErr) {
      console.warn('[signup] Pre-flight user-exists check failed:', checkErr)
    }

    // ============================================
    // Step 1: Create user via admin API
    // ============================================
    console.log('🚀 Creating user via admin API...')
    const myReferralCode = generateReferralCode()
    const now = new Date().toISOString()

    const { data: userData, error: createError } = await authAdmin.createUser({
      email: emailLower,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        is_pro: false,
        my_referral_code: myReferralCode,
        referred_by_code: validatedReferralCode,
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
          errorMsg.toLowerCase().includes('already exists') ||
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('duplicate')) {
        return NextResponse.json({ error: 'Email sudah terdaftar. Silakan login.', code: 'ALREADY_EXISTS' }, { status: 409 })
      }
      if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('too many')) {
        return NextResponse.json({ error: 'Terlalu banyak percobaan. Tunggu beberapa menit.' }, { status: 429 })
      }
      if ((createError as any).code === 'weak_password') {
        return NextResponse.json({ error: 'Password terlalu lemah. Wajib: huruf besar, kecil, angka, dan simbol (!@#$).' }, { status: 400 })
      }
      return NextResponse.json({ error: `Gagal membuat akun: ${errorMsg}` }, { status: 400 })
    }

    const user = userData?.user
    const userId = user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Gagal membuat akun. Silakan coba lagi.' }, { status: 500 })
    }

    console.log('✅ User created')

    // ============================================
    // Step 2: Create profile with verification token
    // ============================================
    const profileResult = await createOrUpdateProfile(admin as any, {
      id: userId, email: emailLower, full_name: fullName,
      deviceId, myReferralCode, referredByCode: validatedReferralCode,
    })

    const savedToken = profileResult.token

    // Also store token in Supabase user metadata as backup for verify-email fallback
    try {
      await authAdmin.updateUserById(userId, {
        user_metadata: {
          ...userData?.user?.user_metadata,
          email_verify_token: savedToken,
          email_verify_exp_at: new Date(Date.now() + VERIFY_EXPIRY_MS).toISOString()
        }
      })
      console.log('✅ Token stored in user metadata')
    } catch (metaErr: any) {
      console.warn('⚠️ Failed to store token in user metadata:', metaErr?.message?.slice(0, 80))
    }

    // ============================================
    // Step 3: Send confirmation email
    // ============================================
    let emailSent = false
    const confirmationUrl = `${getSiteUrl()}/auth/verify?token=${savedToken}`
    const name = fullName || emailLower.split('@')[0]

    try {
      console.log('📧 Sending confirmation email via Resend')
      const fallbackHtml = getConfirmationEmailHtml(name, confirmationUrl)
      const emailResult = await sendEmailFromTemplate({
        to: emailLower,
        subject: 'Verifikasi Akun LuxTrade - Ayo Mulai! 👑',
        templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
        templateParams: { name, confirmationUrl }, fallbackHtml,
      })
      emailSent = emailResult.success
      console.log(emailSent ? '✅ Confirmation email sent!' : '❌ Resend failed')
    } catch (emailErr) {
      console.error('❌ Email send error:', emailErr)
    }

    return NextResponse.json({
      success: true,
      profileCreated: profileResult.success,
      message: emailSent
        ? 'Akun berhasil dibuat! Cek email untuk verifikasi.'
        : 'Akun berhasil dibuat, tapi gagal mengirim email verifikasi.',
      user: { id: userId, email: emailLower },
      emailSent
    })
  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
