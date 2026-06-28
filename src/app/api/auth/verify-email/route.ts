import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

// ============================================
// Auto-migrate: same as signup route
// ============================================
let dbAutoMigrated = false

async function ensureDbMigrated() {
  if (dbAutoMigrated) return
  dbAutoMigrated = true

  const columns = [
    `email TEXT`, `streak_count INTEGER DEFAULT 0`, `last_login_at TIMESTAMPTZ`,
    `best_streak INTEGER DEFAULT 0`,
    `plan TEXT DEFAULT 'FREE'`, `pro_expiry TIMESTAMPTZ`, `role TEXT DEFAULT 'USER'`,
    `full_name TEXT`, `is_pro BOOLEAN DEFAULT false`, `subscription_until TIMESTAMPTZ`,
    `email_verified BOOLEAN DEFAULT false`, `email_verify_token TEXT`,
    `email_verify_exp_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT now()`,
    `updated_at TIMESTAMPTZ DEFAULT now()`, `device_id TEXT`,
    `my_referral_code TEXT`, `referred_by_code TEXT`,
    `has_ever_been_pro BOOLEAN DEFAULT false`, `commission_paid BOOLEAN DEFAULT false`,
  ]
  for (const colDef of columns) {
    try { await db.$executeRawUnsafe(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ${colDef};`) }
    catch { /* ignore */ }
  }

  // Drop duplicate camelCase columns
  const duplicateCols = [
    'streakCount', 'bestStreak', 'createdAt', 'updatedAt', 'lastLoginAt',
    'proExpiry', 'emailVerified', 'emailVerifyToken', 'emailVerifyExpAt',
    'subscriptionStatus',
  ]
  for (const col of duplicateCols) {
    try { await db.$executeRawUnsafe(`ALTER TABLE profiles DROP COLUMN IF EXISTS "${col}";`) }
    catch { /* ignore */ }
  }

  // Drop NOT NULL on all columns dynamically
  try {
    const cols: any[] = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name != 'id';
    `)
    for (const col of cols) {
      try { await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN "${col.column_name}" DROP NOT NULL;`) }
      catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // Set DEFAULTs and indexes
  try {
    await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN created_at SET DEFAULT now();`)
    await db.$executeRawUnsafe(`ALTER TABLE profiles ALTER COLUMN updated_at SET DEFAULT now();`)
    await db.$executeRawUnsafe(`UPDATE profiles SET created_at = now() WHERE created_at IS NULL;`)
    await db.$executeRawUnsafe(`UPDATE profiles SET updated_at = now() WHERE updated_at IS NULL;`)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_verify_token_key ON profiles(email_verify_token) WHERE email_verify_token IS NOT NULL;`)
  } catch { /* ignore */ }
}

/**
 * Activate 7-day PRO trial for a newly verified user.
 * Skips if the user has already had PRO before (has_ever_been_pro = true).
 */
async function activateTrialIfNeeded(userId: string, email: string) {
  try {
    // Check if user already had PRO — skip trial
    const rows = await db.$queryRawUnsafe<any>(`
      SELECT has_ever_been_pro FROM profiles WHERE id = $1 LIMIT 1
    `, userId)
    const profile = Array.isArray(rows) ? rows[0] : null
    
    if (profile?.has_ever_been_pro) {
      console.log('⏭️ User already had PRO, skipping trial')
      return
    }

    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    
    await db.$executeRawUnsafe(`
      UPDATE profiles SET 
        is_pro = true, 
        subscription_status = 'trial',
        subscription_until = $1,
        has_ever_been_pro = true,
        updated_at = now()
      WHERE id = $2
    `, trialEnd.toISOString(), userId)

    // Also update Supabase Auth metadata
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        is_pro: true,
        subscription_status: 'trial',
        subscription_until: trialEnd.toISOString(),
        has_ever_been_pro: true,
      }
    })

    // Also update Supabase profiles table
    await supabaseAdmin.from('profiles').update({
      is_pro: true,
      subscription_status: 'trial',
      subscription_until: trialEnd.toISOString(),
      has_ever_been_pro: true,
      updated_at: new Date().toISOString()
    }).eq('id', userId)

    console.log('🎁 7-day PRO trial activated for:', email)
  } catch (err) {
    console.warn('⚠️ Failed to activate trial:', err)
  }
}

/**
 * POST /api/auth/verify-email
 * Body: { token: string }
 * Verifies email confirmation token, confirms user in Supabase Auth
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    console.log('🔍 Verify email attempt, token length:', token?.length, 'token prefix:', token?.substring(0, 10))

    if (!token || typeof token !== 'string' || token.length < 10) {
      return NextResponse.json(
        { error: 'Token verifikasi nggak valid.', code: 'INVALID_TOKEN' },
        { status: 400 }
      )
    }

    // Pre-flight: auto-migrate
    await ensureDbMigrated()

    // Find profile with matching token using raw SQL
    // IMPORTANT: Use $queryRawUnsafe for SELECT (returns rows[]), NOT $executeRawUnsafe (returns Result object)
    let profile: any = null
    try {
      const rows = await db.$queryRawUnsafe<any>(`
        SELECT id, email, email_verified, email_verify_token, email_verify_exp_at, full_name
        FROM profiles WHERE email_verify_token = $1 LIMIT 1
      `, token)
      profile = Array.isArray(rows) ? rows[0] : null
      if (!profile) console.warn('⚠️ $queryRaw returned:', typeof rows, JSON.stringify(rows)?.slice(0, 200))
    } catch (dbErr: any) {
      console.warn('⚠️ Prisma query failed, trying Supabase fallback:', dbErr.message?.slice(0, 120))
    }

    if (!profile) {
      console.warn('⚠️ No Prisma profile found. Checking Supabase profiles table...')

      // FALLBACK 1: Check Supabase profiles table via service role
      try {
        const { data: supabaseProfile, error: sbError } = await supabaseAdmin
          .from('profiles')
          .select('id, email, email_verified, email_verify_token, email_verify_exp_at, full_name')
          .eq('email_verify_token', token)
          .single()

        if (sbError) {
          console.warn('⚠️ Supabase profiles lookup error:', sbError.message, sbError.code)
        }

        if (supabaseProfile && !sbError) {
          console.log('✅ Found token in Supabase profiles table:', supabaseProfile.id, 'email:', supabaseProfile.email)

          // Check expiry
          if (supabaseProfile.email_verify_exp_at && new Date() > new Date(supabaseProfile.email_verify_exp_at)) {
            return NextResponse.json(
              { error: 'Link verifikasi sudah kadaluarsa. Minta kirim ulang dari halaman login.', code: 'EXPIRED' },
              { status: 410 }
            )
          }

          // Mark verified in Supabase
          await supabaseAdmin.from('profiles').update({
            email_verified: true, email_verify_token: null,
            updated_at: new Date().toISOString()
          }).eq('id', supabaseProfile.id)

          // Confirm in Supabase Auth
          await ensureSupabaseConfirmed(supabaseProfile.id)

          // Activate 7-day PRO trial
          await activateTrialIfNeeded(supabaseProfile.id, supabaseProfile.email)

          // Also update Prisma if possible
          try {
            await db.$executeRawUnsafe(`
              UPDATE profiles SET email_verified = true, email_verify_token = NULL, 
                email_verify_exp_at = NULL, updated_at = now()
              WHERE id = $1
            `, supabaseProfile.id)
          } catch { /* ignore */ }

          console.log('✅ Email verified via Supabase fallback for:', supabaseProfile.email)
          return NextResponse.json({
            success: true,
            message: 'Email berhasil diverifikasi! Kamu mendapat 7 hari PRO gratis! 🎉',
            email: supabaseProfile.email
          })
        }
      } catch (sbLookupErr: any) {
        console.warn('⚠️ Supabase lookup failed:', sbLookupErr?.message || sbLookupErr)
      }

      // FALLBACK 2: Try searching via Supabase admin API (listUsers with metadata filter)
      try {
        console.log('🔍 Fallback 2: Searching via admin listUsers...')
        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1, perPage: 1000
        })
        if (!listErr && users) {
          const matchedUser = users.find((u: any) => u.user_metadata?.email_verify_token === token)
          if (matchedUser) {
            console.log('✅ Found token in auth.users metadata for:', matchedUser.email)
            await ensureSupabaseConfirmed(matchedUser.id)

            // Activate 7-day PRO trial
            await activateTrialIfNeeded(matchedUser.id, matchedUser.email)

            // Also update Prisma
            try {
              await db.$executeRawUnsafe(`
                UPDATE profiles SET email_verified = true, email_verify_token = NULL, 
                  email_verify_exp_at = NULL, updated_at = now()
                WHERE id = $1
              `, matchedUser.id)
            } catch { /* ignore */ }
            return NextResponse.json({
              success: true,
              message: 'Email berhasil diverifikasi! Kamu mendapat 7 hari PRO gratis! 🎉',
              email: matchedUser.email
            })
          }
        }
      } catch (adminErr: any) {
        console.warn('⚠️ Admin listUsers fallback failed:', adminErr?.message || adminErr)
      }

      return NextResponse.json(
        { error: 'Link verifikasi nggak valid. Minta link baru dari halaman login.', code: 'NO_PROFILE' },
        { status: 400 }
      )
    }

    console.log(`🔍 Found profile: id=${profile.id}, email=${profile.email}, verified=${profile.email_verified}`)

    if (profile.email_verified) {
      await ensureSupabaseConfirmed(profile.id)
      return NextResponse.json({
        success: true,
        message: 'Email kamu sudah pernah diverifikasi sebelumnya. Langsung login aja!'
      })
    }

    if (profile.email_verify_exp_at && new Date() > new Date(profile.email_verify_exp_at)) {
      return NextResponse.json(
        { error: 'Link verifikasi sudah kadaluarsa. Minta kirim ulang dari halaman login.', code: 'EXPIRED' },
        { status: 410 }
      )
    }

    // Mark verified via raw SQL
    await db.$executeRawUnsafe(`
      UPDATE profiles SET email_verified = true, email_verify_token = NULL, 
        email_verify_exp_at = NULL, updated_at = now()
      WHERE id = $1
    `, profile.id)
    console.log('✅ Prisma profile marked as verified')

    // Confirm in Supabase Auth
    await ensureSupabaseConfirmed(profile.id)

    // Activate 7-day PRO trial
    await activateTrialIfNeeded(profile.id, profile.email)

    // Update Supabase profiles table
    try {
      await supabaseAdmin.from('profiles')
        .update({ email_verified: true, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
    } catch { /* ignore */ }

    console.log('✅ Email fully verified for user:', profile.id, profile.email)

    return NextResponse.json({
      success: true,
      message: 'Email berhasil diverifikasi! Kamu mendapat 7 hari PRO gratis! 🎉',
      email: profile.email
    })
  } catch (error: any) {
    console.error('❌ Verify email error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}

async function ensureSupabaseConfirmed(userId: string) {
  if (!supabaseAdmin) return
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      user_metadata: { email_verified: true, updated_at: new Date().toISOString() }
    })
    if (error) console.error('❌ Failed to confirm user:', error.message)
    else console.log('✅ User confirmed in Supabase Auth:', userId)
  } catch (err) {
    console.error('❌ Error confirming user:', err)
  }
}