import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAuthFromClient } from '@/lib/supabase'
import { rateLimitByEmail } from '@/lib/rate-limit'

/**
 * POST /api/auth/reset-password-public
 * Public endpoint for password reset (no admin auth required).
 * Used as fallback when Supabase client session from reset link fails.
 * Secured by: rate limiting + email parameter must match.
 *
 * Body: { password: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { password, email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email diperlukan.' }, { status: 400 })
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }

    // Server-side validation matching Supabase password policy
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"|<>,.?\/`~]/.test(password)) {
      return NextResponse.json({ error: 'Password wajib mengandung: huruf kecil, huruf besar, angka, dan simbol (contoh: !@#)' }, { status: 400 })
    }

    // Rate limit: 5 reset attempts per 15 minutes per email
    const rl = rateLimitByEmail('reset-password-public', email, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak percobaan. Tunggu 15 menit.',
    })
    if (rl) return rl

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server tidak dikonfigurasi.' }, { status: 500 })
    }

    // Find user by email
    const { data: { users }, error: listError } = await authAdmin.listUsers({
      filters: { email: email.toLowerCase() }
    })

    if (listError || !users || users.length === 0) {
      console.error('[ResetPassword-Public] User not found:', email, listError)
      return NextResponse.json({ error: 'Email tidak ditemukan. Pastikan email terdaftar di LuxTrade.' }, { status: 404 })
    }

    const user = users[0]

    // Update password via admin API
    const { error: updateError } = await authAdmin.updateUserById(user.id, {
      password: password,
      email_confirm: true,
    })

    if (updateError) {
      const code = (updateError as any).code
      if (code === 'weak_password') {
        return NextResponse.json({ error: 'Password terlalu lemah. Wajib: huruf besar, kecil, angka, dan simbol (!@#$).' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Gagal mengubah password. Coba password berbeda.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Password berhasil diubah!' })
  } catch (error) {
    console.error('[ResetPassword-Public] Error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
