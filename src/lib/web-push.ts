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
import { sendPushNotificationCF, getCfSenderUsed } from '@/lib/web-push-cf'

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

/**
 * Hasil kirim per-subscription yang TERSTRUKTUR.
 *
 * PENTING (fix F5): dulu fungsi ini cuma return boolean — semua kegagalan
 * dianggap "expired" oleh pemanggil → subscription yang MASIH HIDUP ikut
 * terhapus tiap ada masalah server (VAPID missing, library gagal, network).
 * Itu bikin loop neraka: subscribe → tes → gagal → terhapus → tes lagi → ...
 * Sekarang: HANYA 410/404 yang expired; sisanya 'failed' (jangan dihapus!).
 */
export interface PushSendResult {
  ok: boolean
  status: 'sent' | 'expired' | 'failed'
  /** HTTP status dari push service bila request sempat keluar (mis. 410, 403) */
  statusCode?: number
  /** Penjelasan singkat kegagalan (tanpa data sensitif) */
  error?: string
}

/**
 * FIX (log produksi 2026): di CF Workers library web-push Node IMPORT-nya
 * SUKSES tapi selalu gagal saat kirim ("[unenv] https.request is not
 * implemented yet!") — fallback CF-native menyelamatkan, tapi TIAP kirim
 * meninggalkan 1 log error palsu + 1 percobaan sia-sia. Runtime yang sudah
 * terbukti gak mendukung ditandai PERMANEN per isolate → kirim berikutnya
 * langsung lewat jalur CF, log bersih.
 */
let _nodePathBroken = false

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<PushSendResult> {
  const { publicKey, privateKey, subject } = await ensureVapidKeys()
  if (!publicKey || !privateKey) {
    console.warn('[web-push] VAPID keys not configured, skipping push')
    return { ok: false, status: 'failed', error: 'vapid-missing-or-library-unavailable' }
  }

  // ── Jalur 1: library web-push (Node.js) — DI-LEWATI kalau runtime ini
  //    sudah terbukti gak mendukung (_nodePathBroken) biar gak buang waktu
  //    & gak ngeluarin log error palsu di setiap kirim.
  if (!_nodePathBroken) {
    let result: PushSendResult | null = null
    try {
      const keysReady = await ensureVapidDetailsSet()
      if (!keysReady) throw new Error('library-unavailable')
      const wp = await getWebPush()
      if (!wp) throw new Error('library-unavailable')

      await wp.sendNotification(
        subscription,
        JSON.stringify(payload),
        {
          TTL: 86400, // 24 hours
          urgency: 'normal',
        }
      )
      result = { ok: true, status: 'sent', statusCode: 201 }
    } catch (error: any) {
      const statusCode: number | undefined = error?.statusCode
      // 410 = subscription expired, 404 = subscription gone → BOLEH dihapus caller
      if (statusCode === 410 || statusCode === 404) {
        console.log('[web-push] Subscription expired/gone:', subscription.endpoint)
        return { ok: false, status: 'expired', statusCode, error: `http-${statusCode}` }
      }
      const errMsg = String(error?.message || error)
      if (/library-unavailable|unenv|https\.request|not implemented/i.test(errMsg)) {
        // Runtime gak mendukung library Node (stub unenv di CF Workers) →
        // tandai PERMANEN untuk isolate ini, turun ke jalur CF-native.
        _nodePathBroken = true
        console.warn('[web-push] Node sender gak didukung runtime ini → kirim pakai CF-native sender (fallback permanen isolate ini)')
      } else {
        // Kegagalan HTTP NYATA dari push service (401/403 VAPID, 5xx, network)
        // — JANGAN disebut expired: subscription bisa saja masih hidup.
        console.error('[web-push] Send failed:', errMsg)
        return {
          ok: false,
          status: 'failed',
          statusCode,
          error: statusCode ? `http-${statusCode}: ${errMsg}` : errMsg,
        }
      }
    }
    if (result?.ok) return result
  }

  // ── Jalur 2: pengirim CF-native (fetch + WebCrypto, RFC 8291/8292) —
  //    dipakai otomatis di CF Workers (jalur Node kena stub unenv).
  const cf = await sendPushNotificationCF(
    subscription,
    JSON.stringify(payload),
    { publicKey, privateKey, subject }
  )
  if (cf.ok) {
    console.log('[web-push] sent via CF-native sender')
  }
  return cf
}

export interface PushSendSummary {
  sent: number
  /** Endpoint yang BENAR-BENAR mati (410/404) — aman dihapus */
  expired: string[]
  /** Endpoint yang gagal dikirim tapi MASIH HIDUP — jangan dihapus */
  failed: string[]
  /** Pesan error ringkas (maks 1 per endpoint, urut) */
  errors: string[]
}

export async function sendPushToUser(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<PushSendSummary> {
  let sent = 0
  const expired: string[] = []
  const failed: string[] = []
  const errors: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
      if (result.status === 'sent') {
        sent++
      } else if (result.status === 'expired') {
        expired.push(sub.endpoint)
        if (result.error) errors.push(result.error)
      } else {
        failed.push(sub.endpoint)
        errors.push(result.error || 'unknown-error')
      }
    })
  )

  return { sent, expired, failed, errors }
}

// ─── Diagnostics (FASE 5A debug) ─────────────────────────────────────────────

export interface PushCapability {
  runtime: 'node' | 'workers'
  library: 'loaded' | 'unavailable'
  vapidPublicKey: boolean
  vapidPrivateKey: boolean
  /** Pernah terbukti pakai pengirim CF-native di isolate ini */
  cfSenderUsed: boolean
}

/** Status infra push TANPA membocorkan secret — untuk /api/push/capability */
export async function pushCapability(): Promise<PushCapability> {
  const wp = await getWebPush()
  const { publicKey, privateKey } = await ensureVapidKeys()
  return {
    runtime: typeof process !== 'undefined' && process.versions?.node ? 'node' : 'workers',
    library: wp ? 'loaded' : 'unavailable',
    vapidPublicKey: !!publicKey,
    vapidPrivateKey: !!privateKey,
    cfSenderUsed: getCfSenderUsed(),
  }
}

// Probe: kirim ke endpoint PALSU di Apple buat membuktikan pipa crypto+HTTPS
// jalan di runtime ini. Endpoint tidak pernah valid → push service selalu
// balas HTTP 4xx → ITU justru bukti pipa OK. Tanpa data user, tanpa secret.
const PROBE_ENDPOINT = 'https://web.push.apple.com/v0/diagnostic-probe-z'
const PROBE_P256DH = 'BI6C3tFaYy6RcX2C_TVXh2oTS69mk6BWUikSiG0Mu6WmulEDHW8o05LwzJVXQ1LjjYoreyNcPD-fKmp2wYEItvk'
const PROBE_AUTH = 'enEWW_xg_korVIVXnhjCcA'

export interface PushProbeResult {
  outcome: 'http_response' | 'threw' | 'skipped' | 'timeout'
  statusCode?: number
  error?: string
}

let _probeCache: { at: number; result: PushProbeResult } | null = null
const PROBE_TTL_MS = 5 * 60_000

/** Probe koneksi ke push service (cache 5 menit biar gak spam Apple) */
export async function probePush(): Promise<PushProbeResult> {
  if (_probeCache && Date.now() - _probeCache.at < PROBE_TTL_MS) {
    return _probeCache.result
  }
  const cap = await pushCapability()
  if (cap.library !== 'loaded' || !cap.vapidPrivateKey) {
    const result: PushProbeResult = { outcome: 'skipped', error: cap.library !== 'loaded' ? 'library-unavailable' : 'vapid-private-key-missing' }
    _probeCache = { at: Date.now(), result }
    return result
  }
  try {
    const raced = await Promise.race([
      sendPushNotification(
        { endpoint: PROBE_ENDPOINT, keys: { p256dh: PROBE_P256DH, auth: PROBE_AUTH } },
        { title: 'probe', body: 'probe' }
      ),
      new Promise<PushSendResult>((resolve) =>
        setTimeout(() => resolve({ ok: false, status: 'failed', error: 'timeout-15s' }), 15_000)
      ),
    ])
    let result: PushProbeResult
    if (raced.statusCode != null) {
      // Request sempat keluar & dapat balasan HTTP → pipa (crypto+HTTPS) OK
      result = { outcome: 'http_response', statusCode: raced.statusCode }
    } else if (raced.error === 'timeout-15s') {
      result = { outcome: 'timeout' }
    } else {
      result = { outcome: 'threw', error: raced.error || 'unknown' }
    }
    _probeCache = { at: Date.now(), result }
    return result
  } catch (e: any) {
    const result: PushProbeResult = { outcome: 'threw', error: e?.message || 'unknown' }
    _probeCache = { at: Date.now(), result }
    return result
  }
}

// Lazy export for code that still needs the raw library object
export async function getWebPushInstance() {
  return getWebPush()
}
