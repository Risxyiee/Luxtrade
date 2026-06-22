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
 * Generate HMAC-SHA256 signature for DOKU API
 * Signature = HMAC-SHA256("ClientID:Timestamp", SecretKey)
 */
function generateSignature(timestamp: string): string {
  const component = `${DOKU_CLIENT_ID}:${timestamp}`
  return crypto
    .createHmac('sha256', DOKU_SECRET_KEY)
    .update(component)
    .digest('hex')
    .toLowerCase()
}

/**
 * Get current timestamp in ISO format
 */
function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Create DOKU Checkout Payment Order
 * Supports: Virtual Account, E-Wallet, QRIS, Credit Card, etc.
 */
export async function createDokuOrder(params: DokuOrderParams): Promise<DokuOrderResult> {
  const { amount, invoiceId, customerName, customerEmail, plan, durationMonths, paymentType } = params

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    throw new Error('DOKU credentials not configured')
  }

  const timestamp = getTimestamp()
  const signature = generateSignature(timestamp)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Client-Id': DOKU_CLIENT_ID,
    'Request-Id': crypto.randomUUID(),
    'Request-Timestamp': timestamp,
    'Signature': signature,
  }

  const planLabel = durationMonths
    ? `LuxTrade ${plan} Plan - ${durationMonths} Bulan`
    : `LuxTrade ${plan} Plan`

  // Jika user pilih metode bayar spesifik, kirim hanya itu ke DOKU
  const paymentMethodTypes = paymentType
    ? [paymentType]
    : ['VIRTUAL_ACCOUNT', 'E_WALLET', 'QRIS', 'CREDIT_CARD', 'DIRECT_DEBIT', 'ONLINE_TO_OFFLINE']

  const body = {
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

  console.log('🛒 [DOKU] Creating order:', {
    url: `${DOKU_BASE_URL}/checkout/v1/payment`,
    invoiceId,
    amount,
    plan,
    clientId: DOKU_CLIENT_ID.substring(0, 8) + '...',
  })

  try {
    const response = await fetch(`${DOKU_BASE_URL}/checkout/v1/payment`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
 * Verify DOKU webhook signature
 * Returns true if signature is valid
 */
export function verifyDokuCallback(
  signatureHeader: string | null,
  timestamp: string
): boolean {
  if (!signatureHeader || !timestamp) return false

  const expectedSignature = generateSignature(timestamp)

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    )
  } catch {
    // Length mismatch → invalid
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
    env: DOKU_ENV,
    baseUrl: DOKU_BASE_URL,
  }
}
