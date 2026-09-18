import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete all demo trades
    const result = await db.trade.deleteMany({
      where: {
        user_id: session.user.id,
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