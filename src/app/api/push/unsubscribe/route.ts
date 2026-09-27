import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    await db.pushSubscription.deleteMany({
      where: { endpoint },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[push/unsubscribe] Error:', error.message)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
}
