import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ADMIN_EMAIL = 'luxtradee@gmail.com'

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Ensuring admin user exists:', ADMIN_EMAIL)

    // Check if admin user exists
    let adminUser = await db.user.findUnique({
      where: { email: ADMIN_EMAIL }
    })

    if (!adminUser) {
      console.log('❌ Admin user not found, creating...')

      // Create admin user
      adminUser = await db.user.create({
        data: {
          email: ADMIN_EMAIL,
          name: 'LuxTrade Admin',
          emailVerified: new Date(),
        }
      })

      console.log('✅ Admin user created:', adminUser.id)
    } else {
      console.log('✅ Admin user already exists:', adminUser.id)
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        createdAt: adminUser.createdAt
      }
    })
  } catch (error) {
    console.error('❌ Error ensuring admin user:', error)
    return NextResponse.json(
      {
        error: 'Failed to ensure admin user',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
