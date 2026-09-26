import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendPushToUser, type PushPayload } from '@/lib/web-push'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, title, body: messageBody, icon, badge, url, tag, type } = body

    if (!userId || !title || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields (userId, title, body)' }, { status: 400 })
    }

    // Get all subscriptions for this user
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
    })

    if (subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscriptions found for user' })
    }

    const payload: PushPayload = {
      title,
      body: messageBody,
      icon: icon || '/icon-192x192.png',
      badge: badge || '/icon-72x72.png',
      url: url || '/',
      tag: tag || 'default',
      type: type || 'general',
    }

    const result = await sendPushToUser(subscriptions, payload)

    // Clean up expired subscriptions
    if (result.expired.length > 0) {
      await db.pushSubscription.deleteMany({
        where: { endpoint: { in: result.expired } },
      })
    }

    return NextResponse.json({
      sent: result.sent,
      expired: result.expired.length,
      total: subscriptions.length,
    })
  } catch (error: any) {
    console.error('[push/send] Error:', error.message)
    return NextResponse.json({ error: 'Failed to send push notification' }, { status: 500 })
  }
}
