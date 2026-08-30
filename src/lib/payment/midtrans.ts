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
 * Validate Midtrans webhook signature (async — uses Web Crypto API)
 * Uses SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export async function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  providedSignature: string
): Promise<boolean> {
  const hash = await edgeCrypto.sha512(orderId + statusCode + grossAmount + serverKey)
  return hash === providedSignature
}