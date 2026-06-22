import crypto from 'crypto'

// SakuraPay Configuration
const SAKURA_API_ID = process.env.SAKURA_API_ID || ''
const SAKURA_API_KEY = process.env.SAKURA_API_KEY || ''
const SAKURA_ENV = process.env.SAKURA_ENV || 'sandbox'

const SAKURA_BASE_URL = SAKURA_ENV === 'production'
  ? 'https://sakurupiah.id/api/'
  : 'https://sakurupiah.id/api-sanbox/'

const SAKURA_CALLBACK_URL = process.env.SAKURA_CALLBACK_URL || ''
const SAKURA_RETURN_URL = process.env.SAKURA_RETURN_URL || ''

export interface SakuraOrderParams {
  amount: number
  invoiceId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  plan: string
  durationMonths?: number
  paymentMethod: string // SakuraPay payment code: BCAVA, QRIS, GOPAY, DANA, etc.
}

export interface SakuraOrderResult {
  paymentUrl: string
  orderId: string
  invoiceNumber: string
  qrString?: string // For QRIS payments
  paymentNo?: number // Virtual account number, etc.
}

/**
 * Generate SakuraPay Signature
 * Format: HMAC-SHA256(api_id + method + merchant_ref + amount, api_key)
 */
export function generateSignature({
  apiId,
  method,
  merchantRef,
  amount,
  apiKey,
}: {
  apiId: string
  method: string
  merchantRef: string
  amount: string
  apiKey: string
}): string {
  const payload = apiId + method + merchantRef + amount
  return crypto.createHmac('sha256', apiKey).update(payload).digest('hex')
}

/**
 * Verify SakuraPay callback signature
 * Signature = HMAC-SHA256(json_body, api_key)
 */
export function verifyCallbackSignature(
  body: string,
  callbackSignature: string,
): boolean {
  if (!SAKURA_API_KEY || !callbackSignature) return false

  const expectedSignature = crypto
    .createHmac('sha256', SAKURA_API_KEY)
    .update(body)
    .digest('hex')

  return expectedSignature === callbackSignature
}

/**
 * Create SakuraPay Invoice (single payment method per request)
 */
export async function createSakuraOrder(params: SakuraOrderParams): Promise<SakuraOrderResult> {
  const { amount, invoiceId, customerName, customerEmail, customerPhone, plan, durationMonths, paymentMethod } = params

  if (!SAKURA_API_ID || !SAKURA_API_KEY) {
    throw new Error('SakuraPay credentials not configured (SAKURA_API_ID, SAKURA_API_KEY)')
  }

  const amountStr = String(amount)
  const planLabel = durationMonths && durationMonths < 1200
    ? `LuxTrade ${plan} Plan - ${durationMonths} Bulan`
    : `LuxTrade ${plan} Plan`

  // Generate signature
  const signature = generateSignature({
    apiId: SAKURA_API_ID,
    method: paymentMethod,
    merchantRef: invoiceId,
    amount: amountStr,
    apiKey: SAKURA_API_KEY,
  })

  // Build form-data body (SakuraPay uses form-data, not JSON)
  const formData = new URLSearchParams()
  formData.append('api_id', SAKURA_API_ID)
  formData.append('method', paymentMethod)
  formData.append('name', customerName)
  formData.append('email', customerEmail)
  formData.append('phone', customerPhone)
  formData.append('amount', amountStr)
  formData.append('merchant_fee', '1') // Merchant absorbs the fee
  formData.append('merchant_ref', invoiceId)
  formData.append('expired', '24') // 24 hours
  formData.append('produk[]', planLabel)
  formData.append('qty[]', '1')
  formData.append('harga[]', amountStr)
  if (SAKURA_CALLBACK_URL) {
    formData.append('callback_url', SAKURA_CALLBACK_URL)
  }
  if (SAKURA_RETURN_URL) {
    formData.append('return_url', SAKURA_RETURN_URL)
  }
  formData.append('signature', signature)

  const url = `${SAKURA_BASE_URL}create.php`

  console.log('🛒 [SakuraPay] Creating order:', {
    url,
    invoiceId,
    amount: amountStr,
    method: paymentMethod,
    plan,
    apiId: SAKURA_API_ID.substring(0, 8) + '...',
    env: SAKURA_ENV,
  })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SAKURA_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const result = await response.json()
    console.log('📦 [SakuraPay] Response status:', response.status)
    console.log('📦 [SakuraPay] Response body:', JSON.stringify(result).substring(0, 500))

    if (result.status === '200' && result.data && result.data.length > 0) {
      const data = result.data[0]
      const paymentUrl = data.checkout_url || ''

      if (!paymentUrl) {
        console.error('❌ [SakuraPay] No checkout_url in response')
        throw new Error('No payment URL returned from SakuraPay')
      }

      return {
        paymentUrl,
        orderId: data.trx_id || invoiceId,
        invoiceNumber: invoiceId,
        qrString: data.qr || undefined,
        paymentNo: data.payment_no || undefined,
      }
    }

    const errorMessage = result.message || `SakuraPay API error: ${response.status}`
    console.error('❌ [SakuraPay] API Error:', errorMessage)
    throw new Error(errorMessage)
  } catch (error: any) {
    if (error.message.includes('SakuraPay credentials') || error.message.includes('SakuraPay API')) {
      throw error
    }
    console.error('❌ [SakuraPay] Network/Fetch error:', error.message)
    throw new Error(`Gagal terhubung ke SakuraPay: ${error.message}`)
  }
}

/**
 * Check SakuraPay balance
 */
export async function checkSakuraBalance(): Promise<{ balance: string; available: string }> {
  const formData = new URLSearchParams()
  formData.append('api_id', SAKURA_API_ID)
  formData.append('method', 'balance')

  const response = await fetch(`${SAKURA_BASE_URL}check_balance.php`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SAKURA_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  const result = await response.json()
  if (result.status === '200' && result.data) {
    return {
      balance: result.data.balance,
      available: result.data.saldo_tersedia,
    }
  }
  throw new Error(result.message || 'Failed to check balance')
}

/**
 * Get SakuraPay config info
 */
export function getSakuraConfig() {
  return {
    configured: !!SAKURA_API_ID && !!SAKURA_API_KEY,
    apiId: SAKURA_API_ID ? SAKURA_API_ID.substring(0, 8) + '...' : 'NOT SET',
    apiKey: SAKURA_API_KEY ? 'SET (' + SAKURA_API_KEY.length + ' chars)' : 'NOT SET',
    env: SAKURA_ENV,
    baseUrl: SAKURA_BASE_URL,
    callbackUrl: SAKURA_CALLBACK_URL || 'NOT SET',
    returnUrl: SAKURA_RETURN_URL || 'NOT SET',
  }
}

/**
 * SakuraPay payment method codes for reference
 */
export const SAKURA_PAYMENT_METHODS = {
  // QRIS
  QRIS: { code: 'QRIS', label: 'QRIS', min: 500, max: 2000000, fee: 0.7, type: 'DIRECT' },
  QRISMU: { code: 'QRISMU', label: 'QRIS (Multi)', min: 500, max: 5000000, fee: 0.8, type: 'DIRECT' },

  // E-Wallet
  GOPAY: { code: 'GOPAY', label: 'GoPay', min: 500, max: 5000000, fee: 3, type: 'REDIRECT' },
  DANA: { code: 'DANA', label: 'DANA', min: 1000, max: 2000000, fee: 3, type: 'REDIRECT' },
  OVO: { code: 'OVO', label: 'OVO', min: 1000, max: 2000000, fee: 3, type: 'REDIRECT' },
  ShopeePay: { code: 'ShopeePay', label: 'ShopeePay', min: 1000, max: 2000000, fee: 3, type: 'REDIRECT' },
  LinkAja: { code: 'LinkAja', label: 'LinkAja', min: 1000, max: 2000000, fee: 3, type: 'REDIRECT' },

  // Virtual Account
  BCAVA: { code: 'BCAVA', label: 'BCA Virtual Account', min: 10000, max: 15000000, fee: 4900, type: 'DIRECT' },
  BNIVA: { code: 'BNIVA', label: 'BNI Virtual Account', min: 10000, max: 20000000, fee: 3500, type: 'DIRECT' },
  BRIVA: { code: 'BRIVA', label: 'BRI Virtual Account', min: 10000, max: 10000000, fee: 3500, type: 'DIRECT' },
  MANDIRIVA: { code: 'MANDIRIVA', label: 'Mandiri Virtual Account', min: 10000, max: 10000000, fee: 3500, type: 'DIRECT' },
  PERMATAVA: { code: 'PERMATAVA', label: 'Permata Virtual Account', min: 10000, max: 20000000, fee: 3500, type: 'DIRECT' },

  // Retail
  ALFAMART: { code: 'ALFAMART', label: 'Alfamart', min: 10000, max: 5000000, fee: 3000, type: 'DIRECT' },
  INDOMARET: { code: 'INDOMARET', label: 'Indomaret', min: 10000, max: 2500000, fee: 3000, type: 'DIRECT' },
} as const
