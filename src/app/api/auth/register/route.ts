import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'
import { trackSignupFromCookies, SRC_USED_COOKIE, SRC_USED_COOKIE_OPTS } from '@/lib/src-track'

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 signups per 15 minutes per IP
    const rl = checkRateLimit(request, 'register', {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak percobaan daftar. Tunggu 15 menit.',
    })
    if (rl) return rl

    const body = await request.json()
    const { email, password, fullName } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password minimal 8 karakter' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: fullName || email.split('@')[0],
          full_name: fullName || email.split('@')[0],
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'}/auth/callback`,
      },
    })

    if (authError) {
      console.error('❌ Supabase auth error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Gagal membuat akun' },
        { status: 400 }
      )
    }

    if (!data.user?.id) {
      return NextResponse.json(
        { error: 'Failed to create user in Supabase Auth' },
        { status: 500 }
      )
    }

    console.log('✅ User created in Supabase Auth')

    // User is now fully managed in Supabase Auth with metadata

    /* LOOP BELAJAR — ATRIBUSI PENDAFTAR: cookie lux_src (dipasang /api/src-track
       saat kunjungan pertama) menentukan sumber pendaftar ini (last-touch).
       Dedup via cookie lux_src_used → dobel panggil tetap aman. Gagal KV =
       pendaftaran tetap sukses (atribusi opsional, jangan blokir user). */
    let attribution: { src: string; recorded: boolean; dup: boolean } | null = null
    try { attribution = await trackSignupFromCookies(request.cookies) } catch { /* opsional */ }

    const okRes = NextResponse.json({
      success: true,
      message: 'Akun berhasil dibuat. Silakan cek email untuk konfirmasi.',
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    })
    if (attribution && !attribution.dup) okRes.cookies.set(SRC_USED_COOKIE, '1', SRC_USED_COOKIE_OPTS)
    return okRes
  } catch (error) {
    console.error('❌ Registration error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendaftar' },
      { status: 500 }
    )
  }
}
