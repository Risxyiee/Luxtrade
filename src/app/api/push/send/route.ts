import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientAsync } from '@/lib/supabase/admin'
import { sendPushToUser, type PushPayload } from '@/lib/web-push'
import { isUserPro } from '@/lib/pro-check'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, title, body: messageBody, icon, badge, url, tag, type } = body

    if (!userId || !title || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields (userId, title, body)' }, { status: 400 })
    }

    // Check that the target user is Pro — only Pro users can receive push notifications
    const proStatus = await isUserPro(userId)
    if (!proStatus) {
      return NextResponse.json({ sent: 0, message: 'Target user is not Pro — push notifications require Pro' })
    }

    const adminClient = await createAdminClientAsync()
    if (!adminClient) {
      console.error('[push/send] Supabase admin client unavailable')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get all subscriptions for this user
    const { data: subscriptions, error: subErr } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (subErr) {
      console.error('[push/send] Fetch subscriptions failed:', subErr.message)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
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
      await adminClient
        .from('push_subscriptions')
        .delete()
        .in('endpoint', result.expired)
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
