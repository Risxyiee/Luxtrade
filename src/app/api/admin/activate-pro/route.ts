import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ADMIN_EMAIL = 'luxtradee@gmail.com'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminEmail, userId, months } = body

    // Verify admin
    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await db.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Calculate end date
    let endDate: Date | null = null
    const planType = months === 0 ? 'LIFETIME' : 'MONTHLY'

    if (planType === 'LIFETIME') {
      // Lifetime - 10 years
      endDate = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)
    } else if (months) {
      // Monthly - calculate end date
      endDate = new Date()
      endDate.setMonth(endDate.getMonth() + months)
    }

    // Create or update subscription
    const existingSubscription = await db.userSubscription.findFirst({
      where: {
        userId,
        status: 'active'
      }
    })

    if (existingSubscription) {
      // Update existing subscription
      await db.userSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          plan: 'PRO',
          status: 'active',
          endDate,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new subscription
      await db.userSubscription.create({
        data: {
          userId,
          plan: 'PRO',
          status: 'active',
          startDate: new Date(),
          endDate,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `PRO activated for ${months === 0 ? 'lifetime' : months + ' month(s)'}`
    })
  } catch (error) {
    console.error('Error activating PRO:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to activate PRO' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminEmail = searchParams.get('adminEmail')
    const userId = searchParams.get('userId')

    // Verify admin
    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Find and update active subscription
    const activeSubscription = await db.userSubscription.findFirst({
      where: {
        userId,
        status: 'active'
      }
    })

    if (activeSubscription) {
      await db.userSubscription.update({
        where: { id: activeSubscription.id },
        data: {
          status: 'cancelled',
          endDate: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'PRO status deactivated'
    })
  } catch (error) {
    console.error('Error deactivating PRO:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate PRO' },
      { status: 500 }
    )
  }
}
