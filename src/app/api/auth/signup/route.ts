import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json()
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

    // Sign up user with Supabase Auth
    // Supabase will handle email confirmation automatically
    console.log('🚀 Calling supabase.auth.signUp...')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        // Supabase will send confirmation email automatically
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://d18td1p2anb1-d.space.z.ai'}/auth/callback`,
      },
    })

    if (signUpError) {
      console.error('❌ Supabase signup error:', signUpError)
      return NextResponse.json(
        { error: signUpError.message },
        { status: 400 }
      )
    }

    // User created successfully
    if (data.user) {
      console.log('✅ User created:', data.user.id)
      console.log('✅ User email:', data.user.email)
      
      return NextResponse.json({
        success: true,
        message: 'Akun berhasil dibuat! Cek email untuk konfirmasi.',
        user: {
          id: data.user.id,
          email: data.user.email,
        }
      })
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan. Silakan coba lagi.' },
      { status: 500 }
    )
  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    )
  }
}
