import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { db } from '@/lib/db'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'
import crypto from 'crypto'

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LUX'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function generateVerifyToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
const VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

// ============================================
// Auto-migrate: ensures DB schema matches expectations
// Drops duplicate camelCase columns from old Prisma migrations
// ============================================
let dbAutoMigrated = false

async function ensureDbMigrated() {
  if (dbAutoMigrated) return
  dbAutoMigrated = true
  console.log('🔧 [Auto-migrate] Running database setup...')

  // Step 1: Add missing snake_case columns
  const columns = [
    `email TEXT`, `streak_count INTEGER DEFAULT 0`, `last_login_at TIMESTAMPTZ`,
    `best_streak INTEGER DEFAULT 0`,
    // achievements skipped — Supabase has it as jsonb
    `plan TEXT DEFAULT 'FREE'`, `pro_expiry TIMESTAMPTZ`, `role TEXT DEFAULT 'USER'`,
    `full_name TEXT`, `is_pro BOOLEAN DEFAULT false`, `subscription_until TIMESTAMPTZ`,
    `email_verified BOOLEAN DEFAULT false`, `email_verify_token TEXT`,
    `email_verify_exp_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT now()`,
    `updated_at TIMESTAMPTZ DEFAULT now()`, `device_id TEXT`,
    `my_referral_code TEXT`, `referred_by_code TEXT`,
    `has_ever_been_pro BOOLEAN DEFAULT false`, `commission_paid BOOLEAN DEFAULT false`,
  ]

  for (const colDef of columns) {
    try {
      await db.$executeRawUnsafe(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ${colDef};`)
    } catch {
      // Column already exists or type conflict — skip
    }
  }

  // Step 2: Drop duplicate camelCase columns created by old Prisma migrations
  const duplicateCamelCaseColumns = [
    'streakCount', 'bestStreak', 'createdAt', 'updatedAt', 'lastLoginAt',
    'proExpiry', 'emailVerified', 'emailVerifyToken', 'emailVerifyExpAt',
    'subscriptionStatus',
  ]
  for (const col of duplicateCamelCaseColumns) {
    try {
      await db.$executeRawUnsafe(`ALTER TABLE profiles DROP COLUMN IF EXISTS "${col}";`)
      console.log(`  🗑️ Dropped duplicate column: ${col}`)
    } catch {
      // skip
    }
  }

  // Step 3: Dynamically discover ALL columns and DROP NOT NULL
  try {
    const cols: any[] = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name != 'id';
    `)
    console.log(`  🔍 Found ${cols.length} columns in profiles table`)
    for (const col of cols) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE profiles ALTER COLUMN "${col.column_name}" DROP NOT NULL;`
        )
      } catch {
        // skip
      }
    }
    console.log('  ✅ Dropped NOT NULL constraints on all columns')
  } catch (err: any) {
    console.warn(`  ⚠️ Could not enumerate columns: ${err.message?.slice(0, 80)}`)
  }

  // Step 4: Set DEFAULTs
  try {
    await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN created_at SET DEFAULT now();`)
    await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN updated_at SET DEFAULT now();`)
    await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN streak_count SET DEFAULT 0;`)
    await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN best_streak SET DEFAULT 0;`)
    await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN plan SET DEFAULT 'FREE';`)
  } catch {
    // ignore
  }

  // Step 5: Backfill NULLs
  try {
    await db.$executeRawUnsafe(`UPDATE profiles SET created_at = now() WHERE created_at IS NULL;`)
    await db.$executeRawUnsafe(`UPDATE profiles SET updated_at = now() WHERE updated_at IS NULL;`)
  } catch {
    // ignore
  }

  // Step 6: Create partial unique indexes
  try {
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS profiles_my_referral_code_key ON profiles(my_referral_code) WHERE my_referral_code IS NOT NULL;`)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_verify_token_key ON profiles(email_verify_token) WHERE email_verify_token IS NOT NULL;`)
  } catch {
    // ignore
  }

  console.log('✅ [Auto-migrate] Database setup complete')
}

// ============================================
// Create profile using raw SQL (bypasses Prisma @updatedAt issues)
// ============================================
async function createOrUpdateProfile(data: {
  id: string
  email: string
  full_name: string
  deviceId?: string | null
  myReferralCode: string
  referredByCode?: string | null
}): Promise<{ success: boolean; token: string }> {
  const token = generateVerifyToken()
  const expAt = new Date(Date.now() + VERIFY_EXPIRY_MS)

  try {
    await db.$executeRawUnsafe(`
      INSERT INTO profiles (id, email, full_name, plan, is_pro, email_verified, 
        email_verify_token, email_verify_exp_at, device_id, my_referral_code,
        referred_by_code, has_ever_been_pro, commission_paid, streak_count,
        best_streak, achievements, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        email_verify_token = EXCLUDED.email_verify_token,
        email_verify_exp_at = EXCLUDED.email_verify_exp_at,
        achievements = EXCLUDED.achievements,
        updated_at = now()
    `,
      data.id, data.email, data.full_name, 'FREE', false, false,
      token, expAt,
      data.deviceId || null, data.myReferralCode,
      data.referredByCode || null, false, false, 0, 0, '[]',
      new Date(), new Date()
    )
    console.log('✅ Profile created/updated via raw SQL')
    return { success: true, token }
  } catch (err: any) {
    // P2002 = unique constraint (profile already exists), try update
    if (err.code === 'P2002') {
      try {
        await db.$executeRawUnsafe(`
          UPDATE profiles SET 
            email = $1, full_name = $2, 
            email_verify_token = $3, email_verify_exp_at = $4,
            updated_at = now()
          WHERE id = $5
        `, data.email, data.full_name, token, expAt, data.id)
        console.log('✅ Profile updated (already existed)')
        return { success: true, token }
      } catch (updateErr: any) {
        console.error('❌ Profile update failed:', updateErr.message)
      }
    }

    console.error('❌ Profile creation failed:', err.message)
    return { success: false, token: '' }
  }
}

// ============================================
// Main signup handler
// ============================================
export async function POST(request: NextRequest) {
  try {
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

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server tidak dikonfigurasi dengan benar.' }, { status: 500 })
    }

    const admin = supabaseAdmin

    // ============================================
    // PRE-FLIGHT: Auto-migrate database
    // ============================================
    await ensureDbMigrated()

    // ============================================
    // Step 0: Check if email already registered
    // Use $queryRawUnsafe for SELECT (returns rows[])
    // ============================================
    try {
      const existing = await db.$queryRawUnsafe<any>(`
        SELECT id, email, email_verified, full_name FROM profiles 
        WHERE email = $1 LIMIT 1
      `, emailLower)
      const ep = Array.isArray(existing) ? existing[0] : null

      if (ep) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 Email already exists in profiles DB, verified:', ep.email_verified)
        }

        // Cek apakah user masih ada di Supabase Auth
        let userStillExists = false
        try {
          const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({
            page: 1, perPage: 1000
          })
          if (!listErr && users) {
            userStillExists = users.some((u: any) => u.email?.toLowerCase() === emailLower)
          }
        } catch { /* ignore */ }

        if (!userStillExists) {
          // User sudah dihapus dari Supabase Auth, tapi profil masih di DB
          // Hapus profil lama supaya bisa signup ulang
          console.log('🧹 User not in Auth, removing old profile for re-signup')
          try {
            await db.$executeRawUnsafe(`DELETE FROM profiles WHERE id = $1`, ep.id)
            console.log('✅ Profil lama dihapus')
          } catch (delErr: any) {
            console.warn('⚠️ Gagal hapus profil lama:', delErr?.message?.slice(0, 80))
          }
          // Lanjut ke signup (tidak return di sini)
        } else if (ep.email_verified) {
          return NextResponse.json(
            { error: 'Email sudah terdaftar dan terverifikasi. Langsung login aja!', code: 'ALREADY_VERIFIED' },
            { status: 409 }
          )
        } else {
          // User ada tapi belum verifikasi — kirim ulang email
          const newToken = generateVerifyToken()
          const newExpAt = new Date(Date.now() + VERIFY_EXPIRY_MS)
          try {
            await db.$executeRawUnsafe(`
              UPDATE profiles SET email_verify_token = $1, email_verify_exp_at = $2, updated_at = now()
              WHERE id = $3
            `, newToken, newExpAt, ep.id)
          } catch { /* ignore */ }

          const confirmationUrl = `${SITE_URL}/auth/verify?token=${newToken}`
          const name = ep.full_name || fullName || emailLower.split('@')[0]

          try {
            const fallbackHtml = getConfirmationEmailHtml(name, confirmationUrl)
            await sendEmailFromTemplate({
              to: emailLower, subject: 'Kirim Ulang: Verifikasi Akun LuxTrade 👑',
              templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
              templateParams: { name, confirmationUrl }, fallbackHtml,
            })
          } catch { /* ignore */ }

          return NextResponse.json({
            success: true, code: 'RESENT_VERIFICATION',
            message: 'Email sudah terdaftar tapi belum diverifikasi. Kami kirim ulang link verifikasi!',
          })
        }
      }
    } catch { /* ignore, proceed to signup */ }

    // ============================================
    // Step 1: Create user via admin API
    // ============================================
    console.log('🚀 Creating user via admin API...')
    const myReferralCode = generateReferralCode()
    const now = new Date().toISOString()

    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        is_pro: false,
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
          errorMsg.toLowerCase().includes('already exists') ||
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('duplicate')) {
        return NextResponse.json({ error: 'Email sudah terdaftar. Silakan login.', code: 'ALREADY_EXISTS' }, { status: 409 })
      }
      if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('too many')) {
        return NextResponse.json({ error: 'Terlalu banyak percobaan. Tunggu beberapa menit.' }, { status: 429 })
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
    // Step 2: Create profile with verification token (raw SQL)
    // ============================================
    const profileResult = await createOrUpdateProfile({
      id: userId, email: emailLower, full_name: fullName,
      deviceId, myReferralCode, referredByCode: referralCode,
    })

    const savedToken = profileResult.token

    // Also store token in Supabase user metadata as backup for verify-email fallback
    try {
      await admin.auth.admin.updateUserById(userId, {
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
    const confirmationUrl = `${SITE_URL}/auth/verify?token=${savedToken}`
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

    // Also sync to Supabase profiles table (backup for verify-email fallback)
    try {
      await admin.from('profiles').upsert({
        id: userId,
        email: emailLower,
        full_name: fullName,
        plan: 'FREE',
        is_pro: false,
        email_verified: false,
        email_verify_token: savedToken,
        email_verify_exp_at: new Date(Date.now() + VERIFY_EXPIRY_MS).toISOString(),
        device_id: deviceId || null,
        my_referral_code: myReferralCode,
        referred_by_code: referralCode || null,
        has_ever_been_pro: false,
        commission_paid: false,
        created_at: now,
        updated_at: now
      }, { onConflict: 'id' })
      console.log('✅ Supabase profiles table synced with token')
    } catch (supabaseErr: any) {
      console.warn('⚠️ Supabase profiles sync failed:', supabaseErr?.message?.slice(0, 80))
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
