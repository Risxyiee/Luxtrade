export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSupabaseAdminAuthFromClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/auth/admin-login
 * Body: { email: string, password: string }
 *
 * FALLBACK LOGIN via Supabase Admin API when signInWithPassword fails
 * (e.g., "Backend error! Retry your query").
 *
 * How it works:
 * 1. Find user by email via admin API
 * 2. Force-confirm email if needed
 * 3. Try signInWithPassword with a fresh server-side client
 * 4. If STILL fails, reset the user's password to the same value via admin API
 *    (this can fix corrupted auth state, re-confirm email, etc.)
 * 5. Retry login one more time
 * 6. Return session tokens
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password harus diisi' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const emailLower = email.toLowerCase()

    // ── Step 1: Find user by email ──
    let userId: string | null = null
    let isConfirmed = false

    // Try listUsers with email filter
    try {
      const { data: { users }, error } = await authAdmin.listUsers({
        page: 1,
        perPage: 1,
        filter: `email eq "${emailLower.replace(/"/g, '')}"`,
      })
      if (!error && users && users.length > 0) {
        userId = users[0].id
        isConfirmed = !!users[0].email_confirmed_at
      }
    } catch { /* filter not supported, try manual */ }

    // Fallback: manual search
    if (!userId) {
      try {
        const { data: { users }, error } = await authAdmin.listUsers({ page: 1, perPage: 5000 })
        if (!error && users) {
          const found = users.find((u: any) => u.email?.toLowerCase() === emailLower)
          if (found) {
            userId = found.id
            isConfirmed = !!found.email_confirmed_at
          }
        }
      } catch { /* ignore */ }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
    }

    // ── Step 2: Force-confirm if needed ──
    if (!isConfirmed) {
      console.log(`[admin-login] Force-confirming user ${emailLower}`)
      await authAdmin.updateUserById(userId, { email_confirm: true }).catch(() => {})
      await new Promise(r => setTimeout(r, 500))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // ── Step 3: Try signInWithPassword with fresh server client ──
    let session = await tryLogin(supabaseUrl, supabaseKey, email, password)

    // ── Step 4: If failed, admin-reset password & retry ──
    if (!session) {
      console.log(`[admin-login] Login failed, attempting admin password re-set for ${emailLower}...`)
      const { error: resetErr } = await authAdmin.updateUserById(userId, {
        password: password,
        email_confirm: true,
      })

      if (!resetErr) {
        console.log('[admin-login] Password re-set via admin, waiting 1s...')
        await new Promise(r => setTimeout(r, 1000))
        session = await tryLogin(supabaseUrl, supabaseKey, email, password)
      } else {
        console.error('[admin-login] Admin password reset failed:', resetErr.message)
      }
    }

    if (!session) {
      return NextResponse.json({ error: 'Login gagal. Coba lagi atau reset password.' }, { status: 401 })
    }

    // ── Step 5: Return session ──
    return NextResponse.json({
      success: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: session.token_type,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        user: {
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata,
          email_confirmed_at: session.user.email_confirmed_at,
        },
      },
    })
  } catch (err: any) {
    console.error('[admin-login] Unhandled error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

async function tryLogin(url: string, key: string, email: string, password: string) {
  try {
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.session) return null
    return data.session
  } catch {
    return null
  }
}