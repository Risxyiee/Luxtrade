import webpush from 'web-push'

// VAPID keys — set these in .env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@luxtradee.web.id'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  type?: 'trade' | 'price-alert' | 'news' | 'general'
}

export function getVapidPublicKey(): string {
  return vapidPublicKey
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[web-push] VAPID keys not configured, skipping push')
    return false
  }

  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify(payload),
      {
        TTL: 86400, // 24 hours
        urgency: 'normal',
      }
    )
    return true
  } catch (error: any) {
    // 410 = subscription expired, 404 = subscription gone
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log('[web-push] Subscription expired/gone:', subscription.endpoint)
      return false // caller should delete this subscription
    }
    console.error('[web-push] Send failed:', error.message)
    return false
  }
}

export async function sendPushToUser(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<{ sent: number; expired: string[] }> {
  let sent = 0
  const expired: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const success = await sendPushNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
      if (success) {
        sent++
      } else {
        expired.push(sub.endpoint)
      }
    })
  )

  return { sent, expired }
}

export { webpush }
