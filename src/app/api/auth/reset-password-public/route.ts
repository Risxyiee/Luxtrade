import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAuthFromClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { rateLimitByEmail } from '@/lib/rate-limit'

/**
 * POST /api/auth/reset-password-public
 * Reset password untuk user yang datang dari link recovery email.
 *
 * P0 HARDENING (fix account takeover):
 * Dulu endpoint ini TERBUKA — siapapun bisa reset password user APAPUN
 * (termasuk akun admin!) hanya dengan POST {email, password}. Rate limit
 * saja tidak cukup (di Cloudflare Workers rate limit in-memory juga
 * per-isolate). Sekarang WAJIB:
 *   1. Membawa session Supabase yang VALID (cookie ATAU Bearer) — session
 *      ini hanya tercipta kalau user benar-benar mengklik link recovery
 *      dari email-nya.
 *   2. Email pada session HARUS sama dengan email target reset.
 * Halaman /auth/reset-password menetapkan session tersebut dari token
 * di link (PKCE ?code= atau implicit #access_token) sebelum memanggil
 * endpoint ini.
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

    // ── P0: WAJIB session recovery yang valid & email cocok ──────────────
    const auth = await getAuthenticatedUser(request)
    if (!auth.user) {
      return NextResponse.json(
        { error: 'Sesi reset tidak valid atau sudah kedaluwarsa. Buka link reset TERBARU dari email, atau minta link baru dari halaman Lupa Password.' },
        { status: 401 }
      )
    }
    const sessionEmail = (auth.user.email || '').toLowerCase().trim()
    const targetEmail = String(email).toLowerCase().trim()
    if (!sessionEmail || sessionEmail !== targetEmail) {
      return NextResponse.json(
        { error: 'Sesi login tidak cocok dengan email target reset. Buka link reset dari email yang sama.' },
        { status: 403 }
      )
    }

    // Rate limit: 5 reset attempts per 15 minutes per email
    const rl = rateLimitByEmail('reset-password-public', targetEmail, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak percobaan. Tunggu 15 menit.',
    })
    if (rl) return rl

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server tidak dikonfigurasi.' }, { status: 500 })
    }

    // Update password HANYA untuk user yang memiliki session ini
    // (bukan user lain berdasarkan param email — sudah diverifikasi cocok).
    const { error: updateError } = await authAdmin.updateUserById(auth.user.id, {
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
