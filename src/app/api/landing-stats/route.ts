import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const totalUsers = await db.profile.count()

    const activeUsersData = await db.trade.groupBy({ by: ['user_id'] })
    const activeUsers = activeUsersData.length

    const tradesLogged = await db.trade.count()

    return NextResponse.json({
      totalUsers,
      activeUsers,
      tradesLogged,
    })
  } catch (error) {
    console.error('[landing-stats] Error:', error)
    return NextResponse.json({ totalUsers: 0, activeUsers: 0, tradesLogged: 0 }, { status: 500 })
  }
}