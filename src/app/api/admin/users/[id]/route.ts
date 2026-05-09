import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if user has subscriptions
    const subscriptionCount = await db.userSubscription.count({
      where: { userId: id }
    })

    if (subscriptionCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete user with active subscriptions. Please delete subscriptions first.' },
        { status: 400 }
      )
    }

    await db.user.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
