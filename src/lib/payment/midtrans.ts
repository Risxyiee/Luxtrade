import crypto from 'node:crypto'

/**
 * Midtrans Configuration & Helpers
 *
 * Add these to your .env.local (or Vercel environment variables):
 *
 * MIDTRANS_SERVER_KEY=SB-Mid-server-XXXXX
 * MIDTRANS_CLIENT_KEY=SB-Mid-client-XXXXX
 * MIDTRANS_IS_PRODUCTION=false
 *
 * Sandbox keys: https://dashboard.sandbox.midtrans.com/settings/config
 * Production keys: https://dashboard.midtrans.com/settings/config
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

import crypto from 'node:crypto'

/**
 * Validate Midtrans webhook signature
 * Uses SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  providedSignature: string
): boolean {
  const hash = crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex')
  return hash === providedSignature
}