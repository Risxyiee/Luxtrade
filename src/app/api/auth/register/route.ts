import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
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

    console.log('📝 Registering new user:', email)

    // Create user in Supabase Auth
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: fullName || email.split('@')[0],
          full_name: fullName || email.split('@')[0],
        },
        emailRedirectTo: 'https://q1arx165rdc0-d.space.z.ai/auth/callback',
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

    console.log('✅ User created in Supabase Auth, UID:', data.user.id)

    // Upsert user to Prisma with SAME UUID
    try {
      const existingPrismaUser = await db.user.findUnique({
        where: { id: data.user.id }
      })

      if (existingPrismaUser) {
        console.log('⏭️ User already exists in Prisma, updating...')
        await db.user.update({
          where: { id: data.user.id },
          data: {
            name: fullName || email.split('@')[0],
            updatedAt: new Date()
          }
        })
      } else {
        console.log('📋 Creating new user in Prisma...')
        await db.user.create({
          data: {
            id: data.user.id, // Use same UUID from Supabase Auth
            email: data.user.email!,
            name: fullName || email.split('@')[0]
          }
        })
      }

      console.log('✅ User synced to Prisma successfully')
    } catch (prismaError) {
      console.error('⚠️ Error syncing to Prisma:', prismaError)
      // Don't fail the registration if Prisma sync fails
      // User is still created in Supabase Auth
    }

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil dibuat. Silakan cek email untuk konfirmasi.',
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    })
  } catch (error) {
    console.error('❌ Registration error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mendaftar' },
      { status: 500 }
    )
  }
}
