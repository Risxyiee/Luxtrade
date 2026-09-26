import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, endpoint, p256dh, auth, userAgent } = body

    if (!userId || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert — if endpoint already exists, update keys & userId
    const subscription = await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent || null,
      },
      update: {
        userId,
        p256dh,
        auth,
        userAgent: userAgent || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, id: subscription.id })
  } catch (error: any) {
    console.error('[push/subscribe] Error:', error.message)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}
