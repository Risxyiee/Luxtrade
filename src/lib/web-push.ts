/**
 * Web Push Notification Library Wrapper
 *
 * Works in both Node.js (local dev) and Cloudflare Workers (production).
 *
 * KEY FIX: VAPID private key is a secret that's NOT in process.env on CF Workers.
 * We use getEnvVar() from @/lib/cloudflare-bindings to resolve it at call time,
 * which checks globalThis CF context, getCloudflareContext(), and process.env.
 *
 * The web-push library itself also fails on CF Workers (depends on Node.js fs),
 * so we lazy-load it and gracefully degrade if unavailable.
 */

import { getEnvVar } from '@/lib/cloudflare-bindings'

// ─── VAPID Key Resolution ────────────────────────────────────────────────────
// Keys are resolved LAZILY at call time, not at module load time.
// This ensures CF Workers secrets (which require async getEnvVar()) are available.

/** Cached resolved VAPID keys — populated on first call to ensureVapidKeys() */
let _resolvedPublicKey = ''
let _resolvedPrivateKey = ''
let _resolvedSubject = ''
let _vapidKeysResolved = false

/**
 * Ensure VAPID keys are resolved. On first call, tries:
 *   1. process.env (fast path, works in Node.js local dev)
 *   2. getEnvVar() (async, works in CF Workers where secrets are in env bindings)
 *
 * After first successful resolution, results are cached for subsequent calls.
 */
async function ensureVapidKeys(): Promise<{ publicKey: string; privateKey: string; subject: string }> {
  if (_vapidKeysResolved && _resolvedPublicKey && _resolvedPrivateKey) {
    return { publicKey: _resolvedPublicKey, privateKey: _resolvedPrivateKey, subject: _resolvedSubject }
  }

  // 1. Fast path: try process.env first (works in Node.js local dev)
  let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  let privateKey = process.env.VAPID_PRIVATE_KEY || ''
  let subject = process.env.VAPID_SUBJECT || ''

  // 2. If private key not in process.env (CF Workers), try getEnvVar()
  if (!privateKey) {
    try {
      privateKey = await getEnvVar('VAPID_PRIVATE_KEY')
    } catch (err: any) {
      console.warn('[web-push] getEnvVar(VAPID_PRIVATE_KEY) failed:', err?.message || err)
    }
  }

  // 3. Public key is NEXT_PUBLIC_*, so it's usually in process.env.
  //    But as a fallback, also try getEnvVar() for completeness.
  if (!publicKey) {
    try {
      publicKey = await getEnvVar('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
    } catch (err: any) {
      console.warn('[web-push] getEnvVar(NEXT_PUBLIC_VAPID_PUBLIC_KEY) failed:', err?.message || err)
    }
  }

  // 4. Subject fallback
  if (!subject) {
    try {
      subject = await getEnvVar('VAPID_SUBJECT')
    } catch {}
    if (!subject) subject = 'mailto:support@luxtradee.web.id'
  }

  // Cache results
  _resolvedPublicKey = publicKey
  _resolvedPrivateKey = privateKey
  _resolvedSubject = subject
  _vapidKeysResolved = true

  if (!publicKey || !privateKey) {
    console.warn(
      '[web-push] VAPID keys not fully resolved. publicKey:',
      publicKey ? `${publicKey.substring(0, 8)}...` : 'MISSING',
      'privateKey:',
      privateKey ? 'present' : 'MISSING'
    )
  }

  return { publicKey, privateKey, subject }
}

// ─── Web-Push Library Loading ────────────────────────────────────────────────
// Lazy-loaded web-push to avoid Node.js `fs` module import on CF Workers.
// The web-push library uses require('fs') internally which fails on edge runtime.

let _webpush: any = null
let _webpushInit = false
let _webpushVapidSet = false

async function getWebPush(): Promise<any> {
  if (_webpush && _webpushVapidSet) return _webpush
  if (_webpushInit && !_webpush) return null // Already tried and failed
  _webpushInit = true

  try {
    const mod = await import('web-push')
    _webpush = mod.default || mod
    return _webpush
  } catch (err) {
    console.error('[web-push] Failed to load web-push library (likely CF Workers environment):', err)
    return null
  }
}

/** Set VapidDetails on the loaded web-push instance */
async function ensureVapidDetailsSet(): Promise<boolean> {
  if (_webpushVapidSet) return true

  const wp = await getWebPush()
  if (!wp) return false

  const { publicKey, privateKey, subject } = await ensureVapidKeys()
  if (!publicKey || !privateKey) {
    console.warn('[web-push] Cannot setVapidDetails — keys not resolved')
    return false
  }

  try {
    wp.setVapidDetails(subject, publicKey, privateKey)
    _webpushVapidSet = true
    return true
  } catch (err: any) {
    console.error('[web-push] setVapidDetails failed:', err?.message || err)
    return false
  }
}

// Initialize eagerly in Node.js environment (non-edge).
// This ensures the library works in local dev while staying lazy on CF Workers.
// NOTE: VAPID details are NOT set here because we need async ensureVapidKeys().
// They'll be set on first call to ensureVapidDetailsSet().
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('web-push')
    _webpush = mod.default || mod
    _webpushInit = true

    // Eagerly set VapidDetails if keys are available in process.env (local dev)
    const eagerPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
    const eagerPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
    const eagerSubject = process.env.VAPID_SUBJECT || 'mailto:support@luxtradee.web.id'
    if (eagerPublicKey && eagerPrivateKey) {
      try {
        _webpush.setVapidDetails(eagerSubject, eagerPublicKey, eagerPrivateKey)
        _webpushVapidSet = true
        // Cache for ensureVapidKeys()
        _resolvedPublicKey = eagerPublicKey
        _resolvedPrivateKey = eagerPrivateKey
        _resolvedSubject = eagerSubject
        _vapidKeysResolved = true
      } catch (err: any) {
        console.warn('[web-push] Eager setVapidDetails failed:', err?.message || err)
      }
    }
  } catch {
    // Will fall back to lazy loading
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

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

/**
 * Get the VAPID public key.
 * Async because it may need to call getEnvVar() on CF Workers.
 */
export async function getVapidPublicKey(): Promise<string> {
  const { publicKey } = await ensureVapidKeys()
  return publicKey
}

/**
 * Synchronous VAPID public key getter for backward compatibility.
 * Returns cached value or falls back to process.env/NEXT_PUBLIC_.
 * Use getVapidPublicKey() (async) when possible.
 */
export function getVapidPublicKeySync(): string {
  if (_resolvedPublicKey) return _resolvedPublicKey
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<boolean> {
  // Ensure VAPID keys are resolved and set
  const keysReady = await ensureVapidDetailsSet()
  if (!keysReady) {
    console.warn('[web-push] VAPID keys not configured or library unavailable, skipping push')
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
