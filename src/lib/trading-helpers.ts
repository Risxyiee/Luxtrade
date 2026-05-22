// Professional Trading Calculation Functions
// Following global broker standards for all instruments

export type AccountType = 'STANDARD' | 'CENT' | 'ECN' | 'RAW'

export interface TradingAccount {
  id: string
  name: string
  broker: string
  accountType: AccountType
  initialBalance: number
  currentBalance: number
  leverage: number
  currency: string
  isDefault: boolean
}

/**
 * Calculate P/L according to global broker standards
 * 
 * Formula:
 * - BUY: (Exit - Entry) × Lot × Contract Size
 * - SELL: (Entry - Exit) × Lot × Contract Size
 * 
 * For CENT accounts, divide result by 100
 */
export function calculateForexProfitLoss(
  symbol: string,
  type: 'BUY' | 'SELL',
  openPrice: number,
  closePrice: number,
  lotSize: number,
  accountType: AccountType = 'STANDARD'
): number {
  if (!openPrice || !closePrice || !lotSize) return 0

  // Get instrument-specific contract size
  const contractSize = getContractSize(symbol)

  // Calculate price difference based on trade direction
  let priceDiff: number
  if (type === 'BUY') {
    // BUY: Profit when price goes up
    priceDiff = closePrice - openPrice
  } else {
    // SELL: Profit when price goes down
    priceDiff = openPrice - closePrice
  }

  // Calculate P/L: Price Difference × Lot Size × Contract Size
  let profitLoss = priceDiff * lotSize * contractSize

  // For CENT accounts, divide by 100 (1 lot CENT = 0.01 lot STANDARD)
  if (accountType === 'CENT') {
    profitLoss = profitLoss / 100
  }

  // Round to 2 decimal places for USD
  return Math.round(profitLoss * 100) / 100
}

/**
 * Get contract size based on global broker standards
 */
export function getContractSize(symbol: string): number {
  const sym = symbol.toUpperCase()

  // Standard Forex Pairs (EURUSD, GBPUSD, AUDUSD, NZDUSD, etc.)
  // Industry standard: 1 lot = 100,000 units
  if (
    sym.includes('EUR') && sym.includes('USD') ||
    sym.includes('GBP') && sym.includes('USD') ||
    sym.includes('AUD') && sym.includes('USD') ||
    sym.includes('NZD') && sym.includes('USD') ||
    sym.includes('EUR') && sym.includes('GBP') ||
    sym.includes('EUR') && sym.includes('JPY')
  ) {
    return 100000
  }

  // JPY Pairs (USDJPY, EURJPY, GBPJPY, etc.)
  // 1 lot = 100,000 units of the base currency
  if (sym.includes('JPY')) {
    return 100000
  }

  // Gold (XAUUSD) - Industry Standard
  // 1 lot = 100 troy ounces
  if (sym.includes('XAU') || sym.includes('GOLD')) {
    return 100
  }

  // Silver (XAGUSD)
  // 1 lot = 5,000 troy ounces
  if (sym.includes('XAG') || sym.includes('SILVER')) {
    return 5000
  }

  // US30 (Dow Jones Industrial Average)
  // 1 point = $1 per contract
  if (sym.includes('US30') || sym.includes('DOW') || sym.includes('DJ30')) {
    return 1
  }

  // NAS100 (Nasdaq 100)
  // 1 point = $0.20 to $1 depending on broker (using $0.20)
  if (sym.includes('NAS100') || sym.includes('NAS') || sym.includes('NDX')) {
    return 20 // 20 contracts = $20 per point
  }

  // SP500 (S&P 500)
  // 1 point = $0.50
  if (sym.includes('SP500') || sym.includes('S&P') || sym.includes('US500')) {
    return 50 // 50 contracts = $50 per point
  }

  // Bitcoin (BTCUSD)
  // 1 lot = 1 BTC
  if (sym.includes('BTC') || sym.includes('BITCOIN')) {
    return 1
  }

  // Ethereum (ETHUSD)
  // 1 lot = 10 ETH
  if (sym.includes('ETH') || sym.includes('ETHEREUM')) {
    return 10
  }

  // Default to standard forex contract size
  return 100000
}

/**
 * Get pip information for display purposes
 */
export function getPipInfo(symbol: string): {
  description: string
  example: string
  pipValue: string
  decimals: number
} {
  const sym = symbol.toUpperCase()

  if (sym.includes('JPY')) {
    return {
      description: '1 pip = 0.01',
      example: '100,000 units',
      pipValue: '~$9-10 per pip/lot',
      decimals: 2
    }
  }

  if (sym.includes('XAU') || sym.includes('GOLD')) {
    return {
      description: '1 pip = $0.10',
      example: '100 oz contract',
      pipValue: '$10 per pip/lot',
      decimals: 2
    }
  }

  if (sym.includes('XAG') || sym.includes('SILVER')) {
    return {
      description: '1 pip = 0.001',
      example: '5,000 oz contract',
      pipValue: '$5 per pip/lot',
      decimals: 3
    }
  }

  if (sym.includes('US30') || sym.includes('DOW')) {
    return {
      description: '1 point = $1',
      example: 'Index points',
      pipValue: '$1 per point/lot',
      decimals: 0
    }
  }

  if (sym.includes('NAS100') || sym.includes('NAS')) {
    return {
      description: '1 point = 0.25',
      example: 'Index points',
      pipValue: '$5 per pip/lot',
      decimals: 2
    }
  }

  if (sym.includes('BTC')) {
    return {
      description: '1 pip = $1',
      example: 'Per unit',
      pipValue: '$1 per pip/lot',
      decimals: 0
    }
  }

  // Standard forex pairs
  return {
    description: '1 pip = 0.0001',
    example: '100,000 units',
    pipValue: '$10 per pip/lot',
    decimals: 4
  }
}

/**
 * Validate and format numeric input for trading
 * Handles decimal inputs properly
 */
export function formatTradingInput(value: string, decimals: number = 2): number {
  if (!value || value.trim() === '') return 0

  // Remove any non-numeric characters except decimal point and minus
  const cleanValue = value.replace(/[^\d.-]/g, '')

  // Parse as float
  const num = parseFloat(cleanValue)

  if (isNaN(num)) return 0

  // Round to specified decimals
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

/**
 * Format number for display with proper decimal places
 */
export function formatNumberForDisplay(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0'

  return value.toFixed(decimals)
}
