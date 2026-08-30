/**
 * Edge-compatible crypto & encoding utilities.
 * Uses the Web Crypto API (available on Cloudflare Workers, Vercel Edge, Deno, browsers).
 * Drop-in replacement for Node.js `crypto` module and `Buffer` for base64 operations.
 */

// ─── Base64 Encode / Decode (Edge-safe, replaces Buffer.from) ───

/** Encode a string to base64 (replaces `Buffer.from(str).toString('base64')`) */
function base64Encode(str: string): string {
  // Handle Unicode: encode to UTF-8 bytes first
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Encode ArrayBuffer/Uint8Array to base64 (replaces `Buffer.from(arrayBuffer).toString('base64')`) */
function base64EncodeBytes(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary)
}

/** Decode base64 string to Uint8Array (replaces `Buffer.from(str, 'base64')`) */
function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Encode string to base64url (replaces `Buffer.from(str).toString('base64url')`) */
function base64UrlEncode(str: string): string {
  return base64Encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode base64 string to UTF-8 string */
function base64DecodeUtf8(base64: string): string {
  return new TextDecoder().decode(base64Decode(base64))
}

// ─── SHA-256 / SHA-512 Hash ───

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha512(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Base64 Encoding ───

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ─── HMAC-SHA256 ───

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const msgData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Random UUID ───

function randomUUID(): string {
  // Web Crypto API crypto.randomUUID() is available on Edge runtimes
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ─── Random Bytes (hex) ───

function randomBytesHex(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Timing-Safe Comparison ───

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const aBuf = encoder.encode(a)
  const bBuf = encoder.encode(b)
  const view = new Uint8Array(aBuf.length)
  for (let i = 0; i < aBuf.length; i++) {
    view[i] = aBuf[i] ^ bBuf[i]
  }
  return view.reduce((acc, val) => acc | val, 0) === 0
}

export const edgeCrypto = {
  sha256,
  sha512,
  hmacSha256,
  randomUUID,
  randomBytesHex,
  timingSafeEqual,
  arrayBufferToBase64,
  base64Encode,
  base64EncodeBytes,
  base64Decode,
  base64UrlEncode,
  base64DecodeUtf8,
}
