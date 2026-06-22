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
  paymentType?: string  // e.g. 'VIRTUAL_ACCOUNT', 'E_WALLET', 'QRIS', 'CREDIT_CARD'
}

export interface DokuOrderResult {
  paymentUrl: string
  orderId: string
  invoiceNumber: string
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
  // Build signature components separated by \n
  const component = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`,
  ].join('\n')

  // HMAC-SHA256 with secret key, encoded as base64
  const hmac = crypto.createHmac('sha256', secretKey).update(component).digest('base64')

  return `HMACSHA256=${hmac}`
}

/**
 * Get current timestamp in ISO 8601 format (UTC)
 * DOKU expects: 2020-08-11T08:45:42Z
 */
function getTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Create DOKU Checkout Payment Order
 * Docs: https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap/signature-component-from-request-header
 */
export async function createDokuOrder(params: DokuOrderParams): Promise<DokuOrderResult> {
  const { amount, invoiceId, customerName, customerEmail, plan, durationMonths, paymentType } = params

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    throw new Error('DOKU credentials not configured')
  }

  const path = '/checkout/v1/payment'
  const timestamp = getTimestamp()
  const requestId = crypto.randomUUID()

  // Jika user pilih metode bayar spesifik, kirim hanya itu ke DOKU
  const paymentMethodTypes = paymentType
    ? [paymentType]
    : ['VIRTUAL_ACCOUNT', 'E_WALLET', 'QRIS', 'CREDIT_CARD', 'DIRECT_DEBIT', 'ONLINE_TO_OFFLINE']

  const planLabel = durationMonths
    ? `LuxTrade ${plan} Plan - ${durationMonths} Bulan`
    : `LuxTrade ${plan} Plan`

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
        value: String(amount),
        currency: 'IDR',
      },
      line_items: [
        {
          name: planLabel,
          price: {
            value: String(amount),
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
    environment: {
      terminal: 'LuxTrade Web',
    },
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://luxtradee.web.id'}/api/payment/callback`,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://luxtradee.web.id'}/dashboard`,
  }

  const bodyString = JSON.stringify(requestBody)

  // Generate Digest (SHA256 base64 of body)
  const digest = generateDigest(bodyString)

  // Generate Signature (HMAC-SHA256)
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
  }

  console.log('🛒 [DOKU] Creating order:', {
    url: `${DOKU_BASE_URL}${path}`,
    path,
    invoiceId,
    amount,
    plan,
    clientId: DOKU_CLIENT_ID.substring(0, 8) + '...',
    digest: digest.substring(0, 20) + '...',
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
      // DOKU returns payment URL in response.payment.url
      const paymentUrl =
        result.response.payment?.url ||
        result.response.checkout_url ||
        result.response.redirect_url

      if (!paymentUrl) {
        console.error('❌ [DOKU] No payment URL in response:', JSON.stringify(result).substring(0, 1000))
        throw new Error('No payment URL returned from DOKU')
      }

      return {
        paymentUrl,
        orderId: result.response.transaction?.id || invoiceId,
        invoiceNumber: invoiceId,
      }
    }

    // Handle DOKU error format
    const errorMessage =
      (Array.isArray(result.error?.message) ? result.error.message.join(', ') : result.error?.message) ||
      result.message ||
      `DOKU API error: ${response.status} ${response.statusText}`

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
 * Recreates the signature from the callback body and compares
 */
export function verifyDokuCallback(
  signatureHeader: string | null,
  timestamp: string,
  body: string,
): boolean {
  if (!signatureHeader || !timestamp || !body) return false

  try {
    // Generate digest from the received body
    const digest = generateDigest(body)

    // Recreate signature (callback uses same format)
    // For callbacks, Request-Target is usually the callback path
    const expectedSignature = generateSignature({
      clientId: DOKU_CLIENT_ID,
      requestId: '', // Not always present in callbacks
      timestamp,
      requestTarget: '/api/payment/callback',
      digest,
      secretKey: DOKU_SECRET_KEY,
    })

    // Compare signatures (timing-safe)
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    )
  } catch {
    return false
  }
}

/**
 * Get DOKU environment info (for debugging)
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
