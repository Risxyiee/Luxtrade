import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const profiles = await db.profile.findMany({
      select: { id: true, email: true, is_pro: true }
    })

    const trades = await db.trade.findMany({
      take: 5,
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json({
      profiles: {
        count: profiles.length,
        items: profiles
      },
      trades: {
        count: trades.length,
        items: trades
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
