import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete all demo trades
    const result = await db.trade.deleteMany({
      where: {
        user_id: user.id,
        notes: { contains: '[DEMO DATA]' }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.count} demo trades`,
      tradesCleared: result.count
    })
  } catch (error) {
    console.error('[Clear Demo Data] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
