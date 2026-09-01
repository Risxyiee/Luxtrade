import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getSupabaseAdminAuth } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Activate 7-day PRO trial for a newly verified user.
 * Skips if the user has already had PRO before (has_ever_been_pro = true).
 */
async function activateTrialIfNeeded(admin: any, authAdmin: any, userId: string, email: string) {
  try {
    // Check if user already had PRO — skip trial
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('has_ever_been_pro')
      .eq('id', userId)
      .single()

    if (profErr || !profile) {
      console.warn('Could not check has_ever_been_pro:', profErr?.message)
      return
    }

    if (profile.has_ever_been_pro) {
      console.log('⏭️ User already had PRO, skipping trial')
      return
    }

    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Update Supabase profiles table
    const { error: updateErr } = await admin.from('profiles').update({
      is_pro: true,
      subscription_until: trialEnd,
      has_ever_been_pro: true,
      updated_at: new Date().toISOString()
    }).eq('id', userId)

    if (updateErr) {
      console.warn('Failed to update profile for trial:', updateErr.message)
    }

    // Also update Supabase Auth metadata
    if (authAdmin) {
      await authAdmin.updateUserById(userId, {
        user_metadata: {
          is_pro: true,
          subscription_until: trialEnd,
          has_ever_been_pro: true,
        }
      })
    }

    console.log('🎁 7-day PRO trial activated')
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
    // Rate limit: 10 verify attempts per 15 minutes per IP
    const rl = checkRateLimit(request, 'verify-email', {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak percobaan verifikasi. Tunggu 15 menit.',
    })
    if (rl) return rl

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authAdmin = getSupabaseAdminAuth(admin as any)
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const { token } = await request.json()
    console.log('🔍 Verify email attempt, token length:', token?.length, 'token prefix:', token?.substring(0, 10))

    if (!token || typeof token !== 'string' || token.length < 10) {
      return NextResponse.json(
        { error: 'Token verifikasi nggak valid.', code: 'INVALID_TOKEN' },
        { status: 400 }
      )
    }

    // Find profile with matching token using Supabase
    let profile: any = null
    try {
      const { data: found, error: findErr } = await admin
        .from('profiles')
        .select('id, email, email_verified, email_verify_token, email_verify_exp_at, full_name')
        .eq('email_verify_token', token)
        .limit(1)
        .single()

      if (!findErr && found) {
        profile = found
      } else if (findErr) {
        console.warn('⚠️ Supabase profiles lookup error:', findErr.message, findErr.code)
      }
    } catch (dbErr: any) {
      console.warn('⚠️ Supabase query failed, trying fallback:', dbErr.message?.slice(0, 120))
    }

    if (!profile) {
      console.warn('⚠️ No profile found in Supabase profiles table. Checking admin listUsers...')

      // FALLBACK: Try searching via Supabase admin API (listUsers with metadata filter)
      try {
        console.log('🔍 Fallback: Searching via admin listUsers...')
        const { data: { users }, error: listErr } = await authAdmin.listUsers({
          page: 1, perPage: 1000
        })
        if (!listErr && users) {
          const matchedUser = users.find((u: any) => u.user_metadata?.email_verify_token === token)
          if (matchedUser) {
            console.log('✅ Found token in auth.users metadata for:', matchedUser.email)
            await ensureSupabaseConfirmed(authAdmin, matchedUser.id)

            // Activate 7-day PRO trial
            await activateTrialIfNeeded(admin, authAdmin, matchedUser.id, matchedUser.email)

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
      await ensureSupabaseConfirmed(authAdmin, profile.id)
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

    // Mark verified in Supabase profiles table
    const { error: updateErr } = await admin.from('profiles').update({
      email_verified: true,
      email_verify_token: null,
      email_verify_exp_at: null,
      updated_at: new Date().toISOString()
    }).eq('id', profile.id)

    if (updateErr) {
      console.error('❌ Failed to mark profile verified:', updateErr.message)
    } else {
      console.log('✅ Profile marked as verified')
    }

    // Confirm in Supabase Auth
    await ensureSupabaseConfirmed(authAdmin, profile.id)

    // Activate 7-day PRO trial
    await activateTrialIfNeeded(admin, authAdmin, profile.id, profile.email)

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

async function ensureSupabaseConfirmed(authAdmin: any, userId: string) {
  if (!authAdmin) return
  try {
    const { error } = await authAdmin.updateUserById(userId, {
      email_confirm: true,
      user_metadata: { email_verified: true, updated_at: new Date().toISOString() }
    })
    if (error) console.error('❌ Failed to confirm user:', error.message)
    else console.log('✅ User confirmed in Supabase Auth:', userId)
  } catch (err) {
    console.error('❌ Error confirming user:', err)
  }
}
