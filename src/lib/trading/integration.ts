/**
 * Trading Integration Helper
 * Helper functions untuk mengelola integrasi trading pihak ketiga
 */

export interface TradingIntegration {
  id: string
  user_id: string
  name: string
  provider: 'fxblue' | 'myfxbook' | 'custom'
  account_id: string
  investor_password: string
  broker_server: string
  account_type: 'MT4' | 'MT5'
  webhook_url: string
  status: 'active' | 'inactive' | 'error'
  last_sync: string | null
  sync_settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Trade {
  id: string
  user_id: string
  account_number: string
  ticket: string
  symbol: string
  type: 'buy' | 'sell'
  lot: number
  open_price: number
  close_price: number | null
  open_time: string
  close_time: string | null
  profit: number
  commission: number
  swap: number
  comment: string
  source: 'fxblue' | 'myfxbook' | 'custom' | 'metaapi'
  status: 'open' | 'closed'
  created_at: string
  updated_at: string
}

/**
 * Mendapatkan semua integrasi user
 */
export async function getIntegrations(token?: string): Promise<TradingIntegration[]> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch('/api/integrations', { headers })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch integrations')
  }

  return data.integrations || []
}

/**
 * Menambahkan integrasi baru
 */
export async function addIntegration(
  integration: Omit<TradingIntegration, 'id' | 'user_id' | 'webhook_url' | 'last_sync' | 'created_at' | 'updated_at'>,
  token?: string
): Promise<TradingIntegration> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch('/api/integrations', {
    method: 'POST',
    headers,
    body: JSON.stringify(integration)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to add integration')
  }

  return data.integration
}

/**
 * Update integrasi
 */
export async function updateIntegration(
  id: string,
  updates: Partial<TradingIntegration>,
  token?: string
): Promise<TradingIntegration> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`/api/integrations/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update integration')
  }

  return data.integration
}

/**
 * Hapus integrasi
 */
export async function deleteIntegration(id: string, token?: string): Promise<void> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`/api/integrations/${id}`, {
    method: 'DELETE',
    headers
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to delete integration')
  }
}

/**
 * Generate webhook URL untuk integrasi
 */
export function generateWebhookUrl(provider: string, baseUrl?: string): string {
  const appUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com')
  return `${appUrl}/api/webhook/trading?source=${provider}`
}

/**
 * Format trade untuk dikirim ke webhook
 */
export function formatTradeForWebhook(trade: Partial<Trade>, userId: string): any {
  return {
    userId, // Penting: userId harus dikirim untuk routing ke user yang benar
    symbol: trade.symbol,
    ticket: trade.ticket,
    type: trade.type,
    lot: trade.lot,
    openPrice: trade.open_price,
    closePrice: trade.close_price,
    openTime: trade.open_time,
    closeTime: trade.close_time,
    profit: trade.profit,
    commission: trade.commission,
    swap: trade.swap,
    comment: trade.comment
  }
}

/**
 * Validasi data integrasi sebelum dikirim
 */
export function validateIntegrationData(data: any): { valid: boolean; error?: string } {
  if (!data.name) {
    return { valid: false, error: 'Name is required' }
  }

  if (!data.provider) {
    return { valid: false, error: 'Provider is required' }
  }

  if (!['fxblue', 'myfxbook', 'custom'].includes(data.provider)) {
    return { valid: false, error: 'Provider must be fxblue, myfxbook, or custom' }
  }

  if (!data.account_id) {
    return { valid: false, error: 'Account ID is required' }
  }

  if (!data.investor_password) {
    return { valid: false, error: 'Investor Password is required' }
  }

  if (!data.broker_server) {
    return { valid: false, error: 'Broker Server is required' }
  }

  return { valid: true }
}
