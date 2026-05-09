import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, fullName } = body

    console.log('🔄 Upserting user to Prisma:', { userId, email, fullName })

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId and email are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { id: userId }
    })

    if (existingUser) {
      console.log('⏭️ User already exists, updating...')
      // Update existing user
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          name: fullName || email.split('@')[0],
          updatedAt: new Date()
        }
      })

      console.log('✅ User updated in Prisma')
      return NextResponse.json({
        success: true,
        action: 'updated',
        user: updatedUser
      })
    }

    // Create new user
    console.log('📋 Creating new user in Prisma...')
    const newUser = await db.user.create({
      data: {
        id: userId, // Use same UUID from Supabase Auth
        email: email,
        name: fullName || email.split('@')[0]
      }
    })

    console.log('✅ User created in Prisma with UUID:', newUser.id)
    return NextResponse.json({
      success: true,
      action: 'created',
      user: newUser
    })
  } catch (error) {
    console.error('❌ Error upserting user to Prisma:', error)
    return NextResponse.json(
      { error: 'Failed to sync user to Prisma' },
      { status: 500 }
    )
  }
}
