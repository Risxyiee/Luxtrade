import { edgeCrypto } from '@/lib/edge-crypto'

/**
 * Midtrans Configuration & Helpers (Edge-compatible)
 *
 * Add these to your .env (or Cloudflare environment variables):
 *
 * MIDTRANS_SERVER_KEY=SB-Mid-server-XXXXX
 * MIDTRANS_CLIENT_KEY=SB-Mid-client-XXXXX
 * MIDTRANS_IS_PRODUCTION=false
 */

export interface MidtransConfig {
  configured: boolean
  isProduction: boolean
  clientKey: string | null
  serverKeySet: boolean
}

export function getMidtransConfig(): MidtransConfig {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const clientKey = process.env.MIDTRANS_CLIENT_KEY
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

  return {
    configured: !!(serverKey && clientKey),
    isProduction,
    clientKey: clientKey || null,
    serverKeySet: !!serverKey,
  }
}

export function getMidtransSnapUrl(): string {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  return isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js'
}

/**
 * Bandingkan dua string hex dengan WAKTU KONSTAN (anti timing attack).
 * Panjang berbeda tetap memproses loop penuh (tidak bocorkan panjang).
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length === b.length ? 0 : 1
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0)
  }
  return diff === 0
}

/**
 * Validate Midtrans webhook signature (async — uses Web Crypto API)
 * Uses SHA512(order_id + status_code + gross_amount + ServerKey)
 *
 * Hardening:
 * - Fail-closed: signature kosong/bukan string/panjang bukan 128 hex → tolak.
 * - Perbandingan timing-safe (dulu `===` yang rentan timing attack teoretis).
 */
export async function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  providedSignature: string
): Promise<boolean> {
  if (!providedSignature || typeof providedSignature !== 'string') return false
  const provided = providedSignature.toLowerCase()
  // sha512 hex selalu 128 karakter — bentuk lain pasti palsu
  if (provided.length !== 128) return false

  const hash = await edgeCrypto.sha512(orderId + statusCode + grossAmount + serverKey)
  if (!hash || typeof hash !== 'string') return false

  return timingSafeEqualHex(hash.toLowerCase(), provided)
}