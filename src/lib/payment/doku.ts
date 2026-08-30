import { edgeCrypto } from '@/lib/edge-crypto'

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
 * Format amount for DOKU Checkout v1.
 */
function formatAmount(amount: number): number {
  return Math.round(amount)
}

/**
 * Generate Digest (SHA256 base64 of request body) — Edge-compatible
 */
async function generateDigest(body: string): Promise<string> {
  const hashHex = await edgeCrypto.sha256(body)
  // Convert hex to base64
  const bytes = new Uint8Array(hashHex.match(/.{2}/g)!.map(h => parseInt(h, 16)))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Generate HMAC-SHA256 Signature per DOKU spec — Edge-compatible
 */
async function generateSignature({
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
}): Promise<string> {
  const component = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`,
  ].join('\n')

  const hmacHex = await edgeCrypto.hmacSha256(secretKey, component)
  // Convert hex to base64
  const bytes = new Uint8Array(hmacHex.match(/.{2}/g)!.map(h => parseInt(h, 16)))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `HMACSHA256=${btoa(binary)}`
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export async function createDokuOrder(params: DokuOrderParams): Promise<DokuOrderResult> {
  const { amount, invoiceId, customerName, customerEmail, plan, durationMonths, paymentType } = params

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    throw new Error('DOKU credentials not configured')
  }

  const dokuPath = '/checkout/v1/payment'
  const timestamp = getTimestamp()
  const requestId = edgeCrypto.randomUUID()

  const paymentMethodTypes = paymentType
    ? [paymentType]
    : ['VIRTUAL_ACCOUNT', 'E_WALLET', 'QRIS', 'CREDIT_CARD']

  const planLabel = durationMonths && durationMonths < 1200
    ? `LuxTrade ${plan} Plan - ${durationMonths} Bulan`
    : `LuxTrade ${plan} Plan`

  const amountVal = formatAmount(amount)

  const requestBody = {
    payment: {
      payment_method_types: paymentMethodTypes,
      payment_method_options: { reusability: 'single_use' },
    },
    order: {
      invoice_number: invoiceId,
      amount: { value: amountVal, currency: 'IDR' },
      line_items: [{
        name: planLabel,
        price: { value: amountVal, currency: 'IDR' },
        quantity: 1,
        category: 'Digital Service',
        merchant_name: 'LuxTrade',
      }],
    },
    customer: { id: invoiceId, name: customerName, email: customerEmail, phone: '08123456789' },
  }

  const bodyString = JSON.stringify(requestBody)
  const digest = await generateDigest(bodyString)

  const signature = await generateSignature({
    clientId: DOKU_CLIENT_ID, requestId, timestamp,
    requestTarget: dokuPath, digest, secretKey: DOKU_SECRET_KEY,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Client-Id': DOKU_CLIENT_ID,
    'Request-Id': requestId,
    'Request-Timestamp': timestamp,
    'Signature': signature,
    'Digest': digest,
  }

  console.log('🛒 [DOKU] Creating order:', { url: `${DOKU_BASE_URL}${dokuPath}`, invoiceId, amount: amountVal, plan, clientId: DOKU_CLIENT_ID.substring(0, 8) + '...' })

  try {
    const response = await fetch(`${DOKU_BASE_URL}${dokuPath}`, { method: 'POST', headers, body: bodyString })
    const result = await response.json()

    if (response.ok && result.response) {
      const paymentUrl = result.response.payment?.url || result.response.checkout_url || result.response.redirect_url
      if (!paymentUrl) throw new Error('No payment URL returned from DOKU')
      return { paymentUrl, orderId: result.response.transaction?.id || invoiceId, invoiceNumber: invoiceId }
    }

    const errorMessage = (Array.isArray(result.error?.message) ? result.error.message.join(', ') : result.error?.message) || result.message || `DOKU API error: ${response.status}`
    console.error('❌ [DOKU] API Error:', errorMessage)
    throw new Error(errorMessage)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('DOKU credentials') || message.includes('DOKU API')) throw error
    throw new Error(`Gagal terhubung ke DOKU: ${message}`)
  }
}

export async function verifyDokuCallback(
  signatureHeader: string | null,
  timestamp: string,
  body: string,
): Promise<boolean> {
  if (!signatureHeader || !timestamp || !body) return false

  try {
    const digest = await generateDigest(body)
    const expectedSignature = await generateSignature({
      clientId: DOKU_CLIENT_ID, requestId: '', timestamp,
      requestTarget: '/api/payment/callback', digest, secretKey: DOKU_SECRET_KEY,
    })
    return edgeCrypto.timingSafeEqual(signatureHeader, expectedSignature)
  } catch {
    return false
  }
}

export function getDokuConfig() {
  return {
    configured: !!DOKU_CLIENT_ID && !!DOKU_SECRET_KEY,
    clientId: DOKU_CLIENT_ID ? DOKU_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET',
    secretKey: DOKU_SECRET_KEY ? 'SET (' + DOKU_SECRET_KEY.length + ' chars)' : 'NOT SET',
    env: DOKU_ENV,
    baseUrl: DOKU_BASE_URL,
  }
}
