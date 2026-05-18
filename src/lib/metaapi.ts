/**
 * MetaApi Configuration and Helper Functions
 * Handles MetaApi SDK initialization and account management
 */

// MetaApi configuration
export const METAAPI_CONFIG = {
  token: process.env.METAAPI_TOKEN || '',
  api_url: process.env.METAAPI_API_URL || 'https://metaapi.app/api',
  timeout: 60000 // 60 seconds timeout
}

/**
 * Check if MetaApi token is configured
 */
export function isMetaApiConfigured(): boolean {
  return !!METAAPI_CONFIG.token && METAAPI_CONFIG.token.length > 0
}

/**
 * Get MetaApi token (for use in API calls)
 */
export function getMetaApiToken(): string {
  return METAAPI_CONFIG.token
}

/**
 * MetaApi account types
 */
export enum MetaApiAccountType {
  MT4 = 'MT4',
  MT5 = 'MT5'
}

/**
 * MetaApi connection status
 */
export enum MetaApiConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

/**
 * Create MetaApi account using their API
 * This will be called from the backend API route
 */
export async function createMetaApiAccount(accountData: {
  accountNumber: string
  password: string
  server: string
  platform: 'MT4' | 'MT5'
  name?: string
}) {
  if (!isMetaApiConfigured()) {
    throw new Error('MetaApi token is not configured. Please set METAAPI_TOKEN environment variable.')
  }

  const response = await fetch(`${METAAPI_CONFIG.api_url}/users/current/accounts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${METAAPI_CONFIG.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accountNumber: accountData.accountNumber,
      password: accountData.password,
      server: accountData.server,
      platform: accountData.platform,
      name: accountData.name || `Account ${accountData.accountNumber}`
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create MetaApi account')
  }

  return response.json()
}

/**
 * Get MetaApi account information
 */
export async function getMetaApiAccount(accountId: string) {
  if (!isMetaApiConfigured()) {
    throw new Error('MetaApi token is not configured')
  }

  const response = await fetch(`${METAAPI_CONFIG.api_url}/users/current/accounts/${accountId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${METAAPI_CONFIG.token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to get MetaApi account')
  }

  return response.json()
}

/**
 * Delete MetaApi account
 */
export async function deleteMetaApiAccount(accountId: string) {
  if (!isMetaApiConfigured()) {
    throw new Error('MetaApi token is not configured')
  }

  const response = await fetch(`${METAAPI_CONFIG.api_url}/users/current/accounts/${accountId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${METAAPI_CONFIG.token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to delete MetaApi account')
  }

  return response.ok
}

/**
 * Get account deals/trades from MetaApi
 */
export async function getMetaApiDeals(accountId: string, options?: {
  startTime?: string
  endTime?: string
  limit?: number
  offset?: number
}) {
  if (!isMetaApiConfigured()) {
    throw new Error('MetaApi token is not configured')
  }

  const params = new URLSearchParams()
  if (options?.startTime) params.append('startTime', options.startTime)
  if (options?.endTime) params.append('endTime', options.endTime)
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())

  const response = await fetch(
    `${METAAPI_CONFIG.api_url}/users/current/accounts/${accountId}/history/deals?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${METAAPI_CONFIG.token}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to get deals from MetaApi')
  }

  return response.json()
}
