import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSupabaseAdminAuthFromClient } from '@/lib/supabase'

/**
 * POST /api/auth/reset-password-admin
 * Admin fallback for password reset when client session is unavailable.
 * Uses supabaseAdmin which doesn't need a user session.
 *
 * Body: { password: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { password, email } = await request.json()

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password minimal 8 karakter' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email diperlukan untuk reset password.' },
        { status: 400 }
      )
    }

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json(
        { error: 'Server tidak dikonfigurasi dengan benar.' },
        { status: 500 }
      )
    }

    // Find user by email
    const { data: { users }, error: listError } = await authAdmin.listUsers({
      filters: { email: email.toLowerCase() }
    })

    if (listError || !users || users.length === 0) {
      console.error('User not found for password reset:', email, listError)
      return NextResponse.json(
        { error: 'Email tidak ditemukan. Pastikan email terdaftar di LuxTrade.' },
        { status: 404 }
      )
    }

    const user = users[0]

    // Update user password via admin API
    const { error: updateError } = await authAdmin.updateUserById(user.id, {
      password: password,
      email_confirm: true,
    })

    if (updateError) {
      console.error('Admin password update error:', updateError)
      return NextResponse.json(
        { error: `Gagal mengubah password: ${updateError.message}` },
        { status: 400 }
      )
    }

    console.log('✅ Password updated via admin API for:', email)

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah! Silakan login dengan password baru.',
    })
  } catch (error) {
    console.error('Reset password admin API error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    )
  }
}
