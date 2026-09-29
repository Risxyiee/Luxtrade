// VAPID keys — set these in .env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@luxtradee.web.id'

// Lazy-loaded web-push to avoid Node.js `fs` module import on CF Workers
// The web-push library uses require('fs') internally which fails on edge runtime
let _webpush: any = null
let _webpushInit = false

async function getWebPush(): Promise<any> {
  if (_webpush) return _webpush
  if (_webpushInit) return null
  _webpushInit = true

  try {
    const mod = await import('web-push')
    _webpush = mod.default || mod
    if (vapidPublicKey && vapidPrivateKey) {
      _webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    }
    return _webpush
  } catch (err) {
    console.error('[web-push] Failed to load web-push library (likely CF Workers environment):', err)
    return null
  }
}

// Initialize eagerly in Node.js environment (non-edge)
// This ensures the library works in local dev while staying lazy on CF Workers
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('web-push')
    _webpush = mod.default || mod
    _webpushInit = true
    if (vapidPublicKey && vapidPrivateKey) {
      _webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    }
  } catch {
    // Will fall back to lazy loading
  }
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
    const wp = await getWebPush()
    if (!wp) {
      console.warn('[web-push] Library not available (edge runtime?), skipping push')
      return false
    }

    await wp.sendNotification(
      subscription,
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

// Lazy export for code that still needs the raw library object
export async function getWebPushInstance() {
  return getWebPush()
}
