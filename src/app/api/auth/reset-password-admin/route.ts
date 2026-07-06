import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdminAuthFromClient } from '@/lib/supabase'

/**
 * POST /api/auth/reset-password-admin
 * Admin-only: reset any user's password via admin API.
 * Requires admin authentication.
 *
 * Body: { password: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

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

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah!',
    })
  } catch (error) {
    console.error('Reset password admin API error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    )
  }
}