import crypto from 'crypto'

// DOKU Configuration
const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID || ''
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY || ''
const DOKU_ENV = process.env.DOKU_ENV || 'sandbox'
const DOKU_BASE_URL = DOKU_ENV === 'production'
  ? 'https://api.doku.com'
  : 'https://api-sandbox.doku.com'

export interface DokuOrderParams {
  amount: number
  invoiceId: string
  customerName: string
  customerEmail: string
  plan: string
  durationMonths?: number
  paymentType?: string
}

export interface DokuOrderResult {
  paymentUrl: string
  orderId: string
  invoiceNumber: string
}

/**
 * Format amount for DOKU: "120000.00" (string with 2 decimal places)
 * DOKU strictly requires 2 decimal places in the amount value.
 */
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Generate Digest (SHA256 base64 of request body)
 * DOKU requires: Digest = Base64(SHA256(JSON.stringify(body)))
 */
function generateDigest(body: string): string {
  return crypto.createHash('sha256').update(body).digest('base64')
}

/**
 * Generate HMAC-SHA256 Signature per DOKU spec
 * Format:
 *   Client-Id:xxx\nRequest-Id:xxx\nRequest-Timestamp:xxx\nRequest-Target:/path\nDigest:xxx
 * Signature = "HMACSHA256=" + Base64(HMAC-SHA256(signatureString, secretKey))
 */
function generateSignature({
  clientId,
  requestId,
  timestamp,
  requestTarget,
  digest,
  secretKey,
}: {
  clientId: string
  requestId: string
  timestamp: string
  requestTarget: string
  digest: string
  secretKey: string
}): string {
  const component = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`,
  ].join('\n')

  const hmac = crypto.createHmac('sha256', secretKey).update(component).digest('base64')
  return `HMACSHA256=${hmac}`
}

/**
 * Get current timestamp in ISO 8601 format (UTC)
 */
function getTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Create DOKU Checkout Payment Order
 */
export async function createDokuOrder(params: DokuOrderParams): Promise<DokuOrderResult> {
  const { amount, invoiceId, customerName, customerEmail, plan, durationMonths, paymentType } = params

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    throw new Error('DOKU credentials not configured')
  }

  const path = '/checkout/v1/payment'
  const timestamp = getTimestamp()
  const requestId = crypto.randomUUID()

  const paymentMethodTypes = paymentType
    ? [paymentType]
    : ['VIRTUAL_ACCOUNT', 'E_WALLET', 'QRIS', 'CREDIT_CARD']

  const planLabel = durationMonths && durationMonths < 1200
    ? `LuxTrade ${plan} Plan - ${durationMonths} Bulan`
    : `LuxTrade ${plan} Plan`

  const amountStr = formatAmount(amount)

  const requestBody = {
    payment: {
      payment_method_types: paymentMethodTypes,
      payment_method_options: {
        reusability: 'single_use',
      },
    },
    order: {
      invoice_number: invoiceId,
      amount: {
        value: amountStr,
        currency: 'IDR',
      },
      line_items: [
        {
          name: planLabel,
          price: {
            value: amountStr,
            currency: 'IDR',
          },
          quantity: 1,
          category: 'Digital Service',
          merchant_name: 'LuxTrade',
        },
      ],
    },
    customer: {
      id: invoiceId,
      name: customerName,
      email: customerEmail,
      phone: '-',
    },
  }

  const bodyString = JSON.stringify(requestBody)
  const digest = generateDigest(bodyString)

  const signature = generateSignature({
    clientId: DOKU_CLIENT_ID,
    requestId,
    timestamp,
    requestTarget: path,
    digest,
    secretKey: DOKU_SECRET_KEY,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Client-Id': DOKU_CLIENT_ID,
    'Request-Id': requestId,
    'Request-Timestamp': timestamp,
    'Signature': signature,
    'Digest': digest,
  }

  console.log('🛒 [DOKU] Creating order:', {
    url: `${DOKU_BASE_URL}${path}`,
    path,
    invoiceId,
    amount: amountStr,
    plan,
    clientId: DOKU_CLIENT_ID.substring(0, 8) + '...',
    paymentMethodTypes,
  })

  try {
    const response = await fetch(`${DOKU_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: bodyString,
    })

    const result = await response.json()
    console.log('📦 [DOKU] Response status:', response.status)
    console.log('📦 [DOKU] Response body:', JSON.stringify(result).substring(0, 500))

    if (response.ok && result.response) {
      const paymentUrl =
        result.response.payment?.url ||
        result.response.checkout_url ||
        result.response.redirect_url

      if (!paymentUrl) {
        console.error('❌ [DOKU] No payment URL in response')
        throw new Error('No payment URL returned from DOKU')
      }

      return {
        paymentUrl,
        orderId: result.response.transaction?.id || invoiceId,
        invoiceNumber: invoiceId,
      }
    }

    // Handle error
    const errorMessage =
      (Array.isArray(result.error?.message) ? result.error.message.join(', ') : result.error?.message) ||
      result.message ||
      `DOKU API error: ${response.status}`

    console.error('❌ [DOKU] API Error:', errorMessage)
    throw new Error(errorMessage)
  } catch (error: any) {
    if (error.message.includes('DOKU credentials') || error.message.includes('DOKU API')) {
      throw error
    }
    console.error('❌ [DOKU] Network/Fetch error:', error.message)
    throw new Error(`Gagal terhubung ke DOKU: ${error.message}`)
  }
}

/**
 * Verify DOKU webhook/callback signature
 */
export function verifyDokuCallback(
  signatureHeader: string | null,
  timestamp: string,
  body: string,
): boolean {
  if (!signatureHeader || !timestamp || !body) return false

  try {
    const digest = generateDigest(body)
    const expectedSignature = generateSignature({
      clientId: DOKU_CLIENT_ID,
      requestId: '',
      timestamp,
      requestTarget: '/api/payment/callback',
      digest,
      secretKey: DOKU_SECRET_KEY,
    })

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    )
  } catch {
    return false
  }
}

/**
 * Get DOKU config info
 */
export function getDokuConfig() {
  return {
    configured: !!DOKU_CLIENT_ID && !!DOKU_SECRET_KEY,
    clientId: DOKU_CLIENT_ID ? DOKU_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET',
    secretKey: DOKU_SECRET_KEY ? 'SET (' + DOKU_SECRET_KEY.length + ' chars)' : 'NOT SET',
    env: DOKU_ENV,
    baseUrl: DOKU_BASE_URL,
  }
}
