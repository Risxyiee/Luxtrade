/**
 * Web Push Sender — CF-Native (fetch + WebCrypto, ZERO Node deps)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * LATAR (FASE 5 debug): library `web-push` bisa di-import di Cloudflare
 * Workers (OpenNext polyfill), TAPI saat mengirim dia manggil `https.request`
 * yang di workerd cuma stub kosong → error "[unenv] https.request is not
 * implemented yet!" → SEMUA push produksi dari dulu GAGAL diam-diam.
 *
 * Solusi: implementasi Web Push Protocol standar (RFC 8291 + RFC 8188
 * `aes128gcm` + VAPID RFC 8292) pakai API native workerd:
 *   • fetch()          → kirim HTTP ke push service
 *   • WebCrypto ECDSA  → tandatangani JWT VAPID (ES256)
 *   • WebCrypto ECDH   → shared secret enkripsi end-to-end
 *   • WebCrypto AES-GCM+HKDF → enkripsi payload aes128gcm
 *
 * Kompatibel dengan endpoint Apple (web.push.apple.com — wajib aes128gcm),
 * FCM (Chrome/Android), dan Mozilla autopush (Firefox).
 *
 * CATATAN KEAMANAN: fungsi ini hanya MAKAN data — tidak menyentuh env,
 * tidak ada import dari web-push.ts (hindari siklus).
 */

// ─── base64url helpers ───────────────────────────────────────────────────────

function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64url(b: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}

// ─── HMAC-SHA-256 (RFC 8291 memakai HMAC tunggal, bukan HKDF penuh) ─────────

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, data as unknown as BufferSource)
  return new Uint8Array(mac)
}

// ─── VAPID JWT (RFC 8292, ES256) ─────────────────────────────────────────────

export interface CfVapidKeys {
  publicKey: string   // base64url, 65 byte uncompressed point
  privateKey: string  // base64url, 32 byte scalar
  subject: string     // mailto:...
}

/** JWT VAPID dengan klaim aud=origin endpoint, exp=12 jam, sub=mailto */
export async function createVapidJwt(endpoint: string, keys: CfVapidKeys): Promise<string> {
  const aud = new URL(endpoint).origin
  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: keys.subject,
  }
  const enc = new TextEncoder()
  const head = bytesToB64url(enc.encode(JSON.stringify(header)))
  const body = bytesToB64url(enc.encode(JSON.stringify(claims)))
  const signingInput = `${head}.${body}`

  const pub = b64urlToBytes(keys.publicKey)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error(`vapid-public-key-invalid (${pub.length} bytes)`)
  }
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(b64urlToBytes(keys.privateKey)),
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk as unknown as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(signingInput) as unknown as BufferSource
  )
  // WebCrypto ECDSA = raw r||s (64 byte) — persis format JWT ES256
  return `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`
}

// ─── Enkripsi payload aes128gcm (RFC 8291 + header RFC 8188) ────────────────

export async function encryptAes128Gcm(
  payloadBytes: Uint8Array,
  uaPublicKeyB64: string
): Promise<Uint8Array> {
  // 1. Kunci publik user (subscription.keys.p256dh) → JWK
  const uaPublic = b64urlToBytes(uaPublicKeyB64)
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
    throw new Error(`ua-public-key-invalid (${uaPublic.length} bytes)`)
  }
  const uaJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(uaPublic.slice(1, 33)),
    y: bytesToB64url(uaPublic.slice(33, 65)),
  }
  const uaKey = await crypto.subtle.importKey(
    'jwk',
    uaJwk as unknown as JsonWebKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // 2. Pasangan kunci ephemeral pihak server aplikasi
  const asKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256)
  )
  // Public point ephemeral (0x04 || x || y) untuk keyinfo & header
  const asJwk = await crypto.subtle.exportKey('jwk', asKeys.publicKey) as Record<string, string>
  const asEphemeralPublic = concatBytes(
    new Uint8Array([0x04]),
    b64urlToBytes(asJwk.x),
    b64urlToBytes(asJwk.y)
  )

  // 3. Derivasi kunci RFC 8291 §3.3-3.4 (HMAC tunggal per langkah)
  const PRK_key = await hmacSha256(new Uint8Array(16), ecdhSecret) // salt = 0x00*16
  const enc = new TextEncoder()
  const keyInfo = concatBytes(
    enc.encode('WebPush: info'),
    new Uint8Array([0]),
    uaPublic,
    asEphemeralPublic
  )
  const IKM = await hmacSha256(PRK_key, keyInfo)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const PRK = await hmacSha256(salt, IKM)
  const CEK = (await hmacSha256(PRK, concatBytes(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])))).slice(0, 16)
  const NONCE = (await hmacSha256(PRK, concatBytes(enc.encode('Content-Encoding: nonce'), new Uint8Array([0])))).slice(0, 12)

  // 4. Record: payload || delimiter 0x02 (record terakhir) — RFC 8291 §3.5
  const record = concatBytes(payloadBytes, new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', CEK as unknown as BufferSource, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: NONCE as unknown as BufferSource, tagLength: 128 }, aesKey, record as unknown as BufferSource)
  )

  // 5. Header aes128gcm (RFC 8188): salt(16) || rs(4 BE) || idlen(1) || keyid
  const RS = 4096
  const header = new Uint8Array(16 + 4 + 1 + asEphemeralPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RS, false)
  header[20] = asEphemeralPublic.length
  header.set(asEphemeralPublic, 21)

  return concatBytes(header, ciphertext)
}

// ─── Kirim ───────────────────────────────────────────────────────────────────

export interface CfPushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface CfPushSendResult {
  ok: boolean
  status: 'sent' | 'expired' | 'failed'
  statusCode?: number
  error?: string
}

let _cfSenderUsed = false
export function getCfSenderUsed(): boolean {
  return _cfSenderUsed
}

/**
 * Kirim push via fetch+WebCrypto. Struktur hasil SAMA dengan web-push.ts
 * (sent / expired hanya 410-404 / failed) biar caller gak perlu tahu jalur mana.
 */
export async function sendPushNotificationCF(
  subscription: CfPushSubscription,
  payloadJson: string,
  vapid: CfVapidKeys
): Promise<CfPushSendResult> {
  try {
    const jwt = await createVapidJwt(subscription.endpoint, vapid)
    const body = await encryptAes128Gcm(
      new TextEncoder().encode(payloadJson),
      subscription.keys.p256dh
    )

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        // Header yang dipakai HARUS persis — huruf TTL dsb. aman (case-insensitive)
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      },
      body: body as unknown as BodyInit,
    })

    _cfSenderUsed = true

    if (res.status === 201) {
      return { ok: true, status: 'sent', statusCode: 201 }
    }
    if (res.status === 404 || res.status === 410) {
      return { ok: false, status: 'expired', statusCode: res.status, error: `http-${res.status}` }
    }
    // 401/403 VAPID bermasalah, 400 payload, 429/5xx service — JANGAN dihapus sub-nya
    const detail = await res.text().catch(() => '')
    return {
      ok: false,
      status: 'failed',
      statusCode: res.status,
      error: `http-${res.status}: ${detail.slice(0, 180) || res.statusText || 'unknown'}`,
    }
  } catch (error: any) {
    return { ok: false, status: 'failed', error: error?.message || 'cf-sender-unknown-error' }
  }
}
