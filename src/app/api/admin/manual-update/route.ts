import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, plan, proExpiry, adminNote } = body

    // Validation
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (plan !== 'FREE' && plan !== 'PRO') {
      return NextResponse.json(
        { error: 'Plan must be either FREE or PRO' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update user
    const updateData: any = {
      plan,
      role: user.role // Keep existing role
    }

    // If plan is PRO, set expiry date
    if (plan === 'PRO' && proExpiry) {
      updateData.proExpiry = new Date(proExpiry)
    } else if (plan === 'FREE') {
      updateData.proExpiry = null
    }

    // Execute update
    const updatedUser = await db.user.update({
      where: { email },
      data: updateData
    })

    // Also update profiles table for backward compatibility
    try {
      await db.$executeRaw`
        UPDATE auth.profiles
        SET is_pro = ${plan === 'PRO' ? true : false},
            subscription_status = ${plan === 'PRO' ? 'active' : 'FREE'},
            subscription_until = ${proExpiry ? new Date(proExpiry).toISOString() : null},
            updated_at = NOW()
        WHERE email = ${email}
      `
    } catch (error) {
      console.log('Profile update error (may not exist):', error)
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} updated to ${plan}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        plan: updatedUser.plan,
        proExpiry: updatedUser.proExpiry
      }
    })

  } catch (error) {
    console.error('Manual update error:', error)
    return NextResponse.json(
      { error: 'Failed to update user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
