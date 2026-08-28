import crypto from 'crypto'

// SakuraPay Configuration
const SAKURA_API_ID = process.env.SAKURA_API_ID || ''
const SAKURA_API_KEY = process.env.SAKURA_API_KEY || ''
const SAKURA_ENV = process.env.SAKURA_ENV || 'sandbox'

// Production safety flag
const IS_PRODUCTION = SAKURA_ENV === 'production'

// NOTE: SakuraPay's sandbox URL uses "sanbox" (not "sandbox") — this is their actual URL
const SAKURA_BASE_URL = IS_PRODUCTION
  ? 'https://sakurupiah.id/api/'
  : 'https://sakurupiah.id/api-sanbox/'

const SAKURA_CALLBACK_URL = process.env.SAKURA_CALLBACK_URL || ''
const SAKURA_RETURN_URL = process.env.SAKURA_RETURN_URL || ''

// ============================================
// Types
// ============================================

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
  orderId: string      // trx_id from SakuraPay
  invoiceNumber: string // Our merchant_ref
  qrString?: string    // QRIS string for QR payments
  paymentNo?: number  // Virtual account number etc.
  paymentKode?: string // Payment code (e.g. "BCAVA")
  via?: string         // Payment channel name (e.g. "BCA Virtual-Account")
  total?: number       // Total amount
  fee?: number         // Fee amount
  amountMerchant?: number // Amount after fee
  expired?: string     // Expiry date/time
}

export interface SakuraPaymentChannel {
  kode: string
  nama: string
  minimal: string
  maksimal: string
  biaya: string
  percent: string      // "Percent" or "Nominal"
  tipe: string         // "DIRECT" or "REDIRECT"
  logo: string
  status: string       // "Aktif" or "Offline"
  addition: {
    tambahan_biaya: string
    jenis: string
    default_expired: string
    settlement: string
  }
  guide: {
    title: string
    payment_guide: string
  }
}

export interface SakuraTransaction {
  trx_id: string
  merchant_ref: string
  payment_kode: string
  tanggal: string
  waktu: string
  amount: string
  expired: string
  status: string       // "pending", "berhasil", "expired"
}

// ============================================
// Authorization Helper
// ============================================

function getAuthHeaders(contentType = 'application/x-www-form-urlencoded') {
  return {
    'Authorization': `Bearer ${SAKURA_API_KEY}`,
    'Content-Type': contentType,
  }
}

/**
 * Validate that credentials are properly set for the current environment.
 * Throws in production if still using placeholder/sandbox credentials.
 */
function validateCredentials(): void {
  if (!SAKURA_API_ID || !SAKURA_API_KEY) {
    throw new Error('SakuraPay credentials not configured (SAKURA_API_ID, SAKURA_API_KEY)')
  }

  if (IS_PRODUCTION) {
    // In production, API ID/Key should NOT start with SANBOX- or contain placeholder text
    if (SAKURA_API_ID.startsWith('SANBOX-') || SAKURA_API_ID.includes('PUT_YOUR_')) {
      console.error('🚨 [SakuraPay] PRODUCTION MODE but using SANBOX/placeholder credentials!')
      console.error('🚨 [SakuraPay] Transactions will FAIL. Please set production credentials in SAKURA_API_ID / SAKURA_API_KEY')
      throw new Error(
        'SakuraPay is in PRODUCTION mode but credentials are sandbox/placeholder values. ' +
        'Please update SAKURA_API_ID and SAKURA_API_KEY with production values from SakuraPay dashboard.'
      )
    }
  }
}

// ============================================
// Signature
// ============================================

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
 * Signature = HMAC-SHA256(raw_json_body, api_key)
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

// ============================================
// API Calls
// ============================================

/**
 * List all payment channels (active + inactive)
 * POST /api-sanbox/list-payment.php
 */
export async function listPaymentChannels(): Promise<SakuraPaymentChannel[]> {
  const formData = new URLSearchParams()
  formData.append('api_id', SAKURA_API_ID)
  formData.append('method', 'list')

  const response = await fetch(`${SAKURA_BASE_URL}list-payment.php`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData.toString(),
  })

  const result = await response.json()
  if (result.status === '200' && result.data) {
    return result.data
  }
  throw new Error(result.message || 'Failed to list payment channels')
}

/**
 * Check merchant balance
 * POST /api-sanbox/check_balance.php
 */
export async function checkSakuraBalance(): Promise<{ balance: string; available: string; merchantName: string }> {
  const formData = new URLSearchParams()
  formData.append('api_id', SAKURA_API_ID)
  formData.append('method', 'balance')

  const response = await fetch(`${SAKURA_BASE_URL}check_balance.php`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData.toString(),
  })

  const result = await response.json()
  if (result.status === '200' && result.data) {
    return {
      balance: result.data.balance,
      available: result.data.saldo_tersedia,
      merchantName: result.data.nama_merchant,
    }
  }
  throw new Error(result.message || 'Failed to check balance')
}

/**
 * Create SakuraPay Invoice (single payment method per request)
 * POST /api/create.php (production) or /api-sanbox/create.php (sandbox)
 */
export async function createSakuraOrder(params: SakuraOrderParams): Promise<SakuraOrderResult> {
  const { amount, invoiceId, customerName, customerEmail, customerPhone, plan, durationMonths, paymentMethod } = params

  validateCredentials()

  const amountStr = String(amount)
  const planLabel = durationMonths && durationMonths < 1200
    ? `LuxTrade ${plan} Plan - ${durationMonths} Bulan`
    : `LuxTrade ${plan} Plan`

  // Generate signature: HMAC-SHA256(api_id + method + merchant_ref + amount, api_key)
  const signature = generateSignature({
    apiId: SAKURA_API_ID,
    method: paymentMethod,
    merchantRef: invoiceId,
    amount: amountStr,
    apiKey: SAKURA_API_KEY,
  })

  // Build form-data body — SakuraPay uses application/x-www-form-urlencoded (http_build_query in PHP)
  const formData = new URLSearchParams()
  formData.append('api_id', SAKURA_API_ID)
  formData.append('method', paymentMethod)
  formData.append('name', customerName)
  formData.append('email', customerEmail)
  formData.append('phone', customerPhone)
  formData.append('amount', amountStr)
  formData.append('merchant_fee', '1')  // 1=merchant absorbs fee, 2=customer absorbs fee
  formData.append('merchant_ref', invoiceId)
  formData.append('expired', '24')      // 24 hours expiry
  formData.append('produk[]', planLabel)
  formData.append('qty[]', '1')
  formData.append('harga[]', amountStr)

  // Callback and return URLs (required)
  if (SAKURA_CALLBACK_URL) {
    formData.append('callback_url', SAKURA_CALLBACK_URL)
  }
  if (SAKURA_RETURN_URL) {
    formData.append('return_url', SAKURA_RETURN_URL)
  }

  formData.append('signature', signature)

  const url = `${SAKURA_BASE_URL}create.php`

  console.log(`${IS_PRODUCTION ? '🛒' : '🧪'} [SakuraPay${IS_PRODUCTION ? ' PROD' : ' SANDBOX'}] Creating order:`, {
    url,
    invoiceId,
    amount: amountStr,
    method: paymentMethod,
    plan,
    apiId: SAKURA_API_ID.substring(0, 8) + '...',
    env: SAKURA_ENV,
    isProduction: IS_PRODUCTION,
    callbackUrl: SAKURA_CALLBACK_URL || 'NOT SET',
    returnUrl: SAKURA_RETURN_URL || 'NOT SET',
  })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData.toString(),
    })

    const result = await response.json()
    console.log('📦 [SakuraPay] Response status:', response.status)
    console.log('📦 [SakuraPay] Response body:', JSON.stringify(result).substring(0, 800))

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
        paymentKode: data.payment_kode || undefined,
        via: data.via || undefined,
        total: data.total || undefined,
        fee: data.fee || undefined,
        amountMerchant: data.amount_merchant || undefined,
        expired: data.expired || undefined,
      }
    }

    const errorMessage = result.message || `SakuraPay API error: ${response.status}`
    console.error('❌ [SakuraPay] API Error:', errorMessage)
    throw new Error(errorMessage)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('SakuraPay credentials') || message.includes('SakuraPay API')) {
      throw error
    }
    console.error('❌ [SakuraPay] Network/Fetch error:', message)
    throw new Error(`Gagal terhubung ke SakuraPay: ${message}`)
  }
}

/**
 * Check transaction status
 * POST /api/status-transaction.php (production) or /api-sanbox/status-transaction.php (sandbox)
 */
export async function checkTransactionStatus(trxId: string): Promise<{ status: string }> {
  const formData = new URLSearchParams()
  formData.append('api_id', SAKURA_API_ID)
  formData.append('method', 'status')
  formData.append('trx_id', trxId)

  const response = await fetch(`${SAKURA_BASE_URL}status-transaction.php`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData.toString(),
  })

  const result = await response.json()
  if (result.status === '200' && result.data && result.data.length > 0) {
    return { status: result.data[0].status }
  }
  throw new Error(result.message || 'Failed to check transaction status')
}

/**
 * Get transaction history
 * POST /api/transaction.php (production) or /api-sanbox/transaction.php (sandbox)
 */
export async function getTransactionHistory(filters?: {
  paymentKode?: string
  trxId?: string
  merchantRef?: string
  status?: string
  startDate?: string
  endDate?: string
}): Promise<SakuraTransaction[]> {
  const formData = new URLSearchParams()
  formData.append('api_id', SAKURA_API_ID)
  formData.append('method', 'transaction')
  formData.append('mechant', '1') // 1 = only this merchant's transactions

  if (filters?.paymentKode) formData.append('payment_kode', filters.paymentKode)
  if (filters?.trxId) formData.append('trx_id', filters.trxId)
  if (filters?.merchantRef) formData.append('merchant_ref', filters.merchantRef)
  if (filters?.status) formData.append('status', filters.status)
  if (filters?.startDate) formData.append('tanggal_awal', filters.startDate)
  if (filters?.endDate) formData.append('tanggal_akhir', filters.endDate)

  const response = await fetch(`${SAKURA_BASE_URL}transaction.php`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData.toString(),
  })

  const result = await response.json()
  if (result.status === '200' && result.data) {
    return result.data
  }
  throw new Error(result.message || 'Failed to get transaction history')
}

// ============================================
// Config & Helper
// ============================================

export function getSakuraConfig() {
  return {
    configured: !!SAKURA_API_ID && !!SAKURA_API_KEY,
    apiId: SAKURA_API_ID ? SAKURA_API_ID.substring(0, 8) + '...' : 'NOT SET',
    apiKey: SAKURA_API_KEY ? 'SET (' + SAKURA_API_KEY.length + ' chars)' : 'NOT SET',
    env: SAKURA_ENV,
    isProduction: IS_PRODUCTION,
    baseUrl: SAKURA_BASE_URL,
    callbackUrl: SAKURA_CALLBACK_URL || 'NOT SET',
    returnUrl: SAKURA_RETURN_URL || 'NOT SET',
    credentialsValid: IS_PRODUCTION ? !SAKURA_API_ID.startsWith('SANBOX-') && !SAKURA_API_ID.includes('PUT_YOUR_') : true,
  }
}

/**
 * Check if SakuraPay is in production mode
 */
export function isProductionMode(): boolean {
  return IS_PRODUCTION
}

/**
 * SakuraPay payment method codes — based on official documentation
 * Fees: Percent = % of amount, Nominal = flat fee
 */
export const SAKURA_PAYMENT_METHODS = {
  // QRIS
  QRIS:    { code: 'QRIS',    label: 'QRIS',             min: 500,    max: 2000000,  fee: '0.7%',   type: 'DIRECT' },
  QRIS2:   { code: 'QRIS2',   label: 'QRIS2',            min: 100,    max: 10000000, fee: '0.9%',   type: 'DIRECT' },
  QRISC:   { code: 'QRISC',   label: 'QRISC',            min: 200,    max: 20000000, fee: '0.7%',   type: 'DIRECT' },
  QRISMU:  { code: 'QRISMU',  label: 'QRIS Multi',       min: 500,    max: 5000000,  fee: '0.8%',   type: 'DIRECT' },

  // E-Wallet
  GOPAY:     { code: 'GOPAY',     label: 'GoPay',              min: 500,   max: 5000000,  fee: '3%',     type: 'REDIRECT' },
  DANA:      { code: 'DANA',      label: 'DANA E-Wallet',      min: 1000,  max: 2000000,  fee: '3%',     type: 'REDIRECT' },
  OVO:       { code: 'OVO',       label: 'OVO E-Wallet',       min: 1000,  max: 2000000,  fee: '3%',     type: 'REDIRECT' },
  ShopeePay: { code: 'ShopeePay', label: 'ShopeePay',         min: 1000,  max: 2000000,  fee: '3%',     type: 'REDIRECT' },
  LinkAja:   { code: 'LinkAja',   label: 'LinkAja',           min: 1000,  max: 2000000,  fee: '3%',     type: 'REDIRECT' },

  // Virtual Account
  BCAVA:     { code: 'BCAVA',     label: 'BCA Virtual-Account',  min: 10000, max: 15000000, fee: 'Rp4.900', type: 'DIRECT' },
  BNIVA:     { code: 'BNIVA',     label: 'BNI Virtual-Account',  min: 10000, max: 20000000, fee: 'Rp3.500', type: 'DIRECT' },
  BRIVA:     { code: 'BRIVA',     label: 'BRI Virtual-Account',  min: 10000, max: 10000000, fee: 'Rp3.500', type: 'DIRECT' },
  MANDIRIVA: { code: 'MANDIRIVA', label: 'Mandiri Virtual-Account', min: 10000, max: 10000000, fee: 'Rp3.500', type: 'DIRECT' },
  PERMATAVA: { code: 'PERMATAVA', label: 'Permata Virtual-Account', min: 10000, max: 20000000, fee: 'Rp3.500', type: 'DIRECT' },
  BSIVA:     { code: 'BSIVA',     label: 'BSI Virtual-Account',   min: 10000, max: 20000000, fee: 'Rp3.500', type: 'DIRECT' },
  DANAMON:   { code: 'DANAMON',   label: 'Danamon Virtual-Account', min: 10000, max: 15000000, fee: 'Rp3.500', type: 'DIRECT' },
  CIMBVA:    { code: 'CIMBVA',    label: 'CIMB Niaga Virtual-Account', min: 10000, max: 10000000, fee: 'Rp3.500', type: 'DIRECT' },
  OCBC:      { code: 'OCBC',      label: 'OCBC Virtual-Account',  min: 10000, max: 10000000, fee: 'Rp3.500', type: 'DIRECT' },
  MUAMALAT:  { code: 'MUAMALAT',  label: 'Muamalat Virtual-Account', min: 10000, max: 15000000, fee: 'Rp3.500', type: 'DIRECT' },
  SINARMAS:  { code: 'SINARMAS',  label: 'Sinarmas Virtual-Account', min: 10000, max: 10000000, fee: 'Rp3.500', type: 'DIRECT' },
  BNCVA:     { code: 'BNCVA',     label: 'BNC Virtual-Account',   min: 10000, max: 10000000, fee: 'Rp3.500', type: 'DIRECT' },
  BAGVA:     { code: 'BAGVA',     label: 'BAG Virtual-Account',   min: 10000, max: 15000000, fee: 'Rp4.200', type: 'DIRECT' },

  // Retail (Convenience Store)
  ALFAMART:  { code: 'ALFAMART',  label: 'Alfamart',          min: 10000, max: 5000000,  fee: 'Rp3.000', type: 'DIRECT' },
  INDOMARET: { code: 'INDOMARET', label: 'Indomaret',         min: 10000, max: 2500000,  fee: 'Rp3.000', type: 'DIRECT' },
} as const
