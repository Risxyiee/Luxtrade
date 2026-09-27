import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Token tidak valid', request.url)
      )
    }

    // Redirect to login with success message
    // Note: Supabase handles email verification automatically
    return NextResponse.redirect(
      new URL('/auth/login?verified=true', request.url)
    )
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.redirect(
      new URL('/auth/login?error=Terjadi kesalahan saat verifikasi', request.url)
    )
  }
}
