/**
 * Midtrans helper functions
 * Replace DOKU dengan Midtrans untuk payment processing
 */

import { logger } from '../logger'
import crypto from 'crypto'

export interface MidtransConfig {
  serverKey: string
  clientKey: string
  configured: boolean
  isProduction: boolean
}

export interface MidtransTransaction {
  transaction_id: string
  order_id: string
  gross_amount: number
  currency: string
  payment_type: string
  transaction_status: string // pending, settlement, failure, cancel, deny, etc.
  transaction_time: string
  settlement_time?: string
}

/**
 * Get Midtrans configuration
 */
export function getMidtransConfig(): MidtransConfig {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const clientKey = process.env.MIDTRANS_CLIENT_KEY
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

  return {
    serverKey: serverKey || '',
    clientKey: clientKey || '',
    configured: !!(serverKey && clientKey),
    isProduction,
  }
}

/**
 * Verify Midtrans signature
 * Used for webhook callback verification
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signature: string
): boolean {
  try {
    const config = getMidtransConfig()
    if (!config.configured) {
      logger.warn('Midtrans not configured, skipping signature verification')
      return false
    }

    const hashInput = `${orderId}${statusCode}${grossAmount}${config.serverKey}`
    const hash = crypto.createHash('sha512').update(hashInput).digest('hex')

    return hash === signature
  } catch (error) {
    logger.error('Error verifying Midtrans signature', error)
    return false
  }
}

/**
 * Format amount to Midtrans (integer in smallest currency unit)
 * For IDR, no decimal places needed
 */
export function formatAmountForMidtrans(amount: number): number {
  return Math.round(amount)
}

/**
 * Map Midtrans transaction status to app status
 */
export function mapMidtransStatus(midtransStatus: string): 'pending' | 'success' | 'failed' | 'cancelled' {
  switch (midtransStatus) {
    case 'settlement':
    case 'capture':
      return 'success'
    case 'pending':
      return 'pending'
    case 'deny':
    case 'expire':
    case 'cancel':
      return 'cancelled'
    case 'failure':
    default:
      return 'failed'
  }
}

/**
 * Log transaction event
 */
export function logMidtransEvent(
  event: string,
  transaction: Partial<MidtransTransaction>,
  details?: Record<string, any>
): void {
  logger.info(`Midtrans ${event}`, {
    order_id: transaction.order_id,
    transaction_id: transaction.transaction_id,
    status: transaction.transaction_status,
    amount: transaction.gross_amount,
    ...details,
  })
}
