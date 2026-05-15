import { NextRequest, NextResponse } from 'next/server'

// Forex symbols mapping
const FOREX_SYMBOLS: Record<string, { from: string; to: string; basePrice: number }> = {
  'XAUUSD': { from: 'XAU', to: 'USD', basePrice: 2350.00 },  // Gold
  'XAGUSD': { from: 'XAG', to: 'USD', basePrice: 28.50 },   // Silver
  'EURUSD': { from: 'EUR', to: 'USD', basePrice: 1.0850 },
  'GBPUSD': { from: 'GBP', to: 'USD', basePrice: 1.2650 },
  'USDJPY': { from: 'USD', to: 'JPY', basePrice: 148.50 },
  'EURGBP': { from: 'EUR', to: 'GBP', basePrice: 0.8550 },
  'EURJPY': { from: 'EUR', to: 'JPY', basePrice: 161.20 },
  'GBPJPY': { from: 'GBP', to: 'JPY', basePrice: 188.50 },
  'AUDUSD': { from: 'AUD', to: 'USD', basePrice: 0.6550 },
  'NZDUSD': { from: 'NZD', to: 'USD', basePrice: 0.6120 },
  'USDCAD': { from: 'USD', to: 'CAD', basePrice: 1.3650 },
  'USDCHF': { from: 'USD', to: 'CHF', basePrice: 0.8950 },
}

// Alpha Vantage API (Free tier - 25 requests/day)
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || ''

// Mock data generator for forex
function generateMockForexData(symbol: string, count: number = 50) {
  const data = []
  let timestamp = Date.now() - (count * 15 * 60 * 1000) // Start from count*15min ago

  // Get symbol info or default to EURUSD
  const symbolInfo = FOREX_SYMBOLS[symbol] || FOREX_SYMBOLS['EURUSD']
  let basePrice = symbolInfo.basePrice

  for (let i = 0; i < count; i++) {
    // Generate realistic OHLC data with lower volatility for forex
    const volatility = basePrice * 0.001 // 0.1% volatility for forex (more stable)
    const open = basePrice
    const high = basePrice + Math.random() * volatility
    const low = basePrice - Math.random() * volatility
    const close = basePrice + (Math.random() - 0.5) * volatility

    data.push({
      time: Math.floor(timestamp / 1000), // Convert to seconds
      open: parseFloat(open.toFixed(5)),
      high: parseFloat(high.toFixed(5)),
      low: parseFloat(low.toFixed(5)),
      close: parseFloat(close.toFixed(5)),
    })

    // Update base price for next candle
    basePrice = close
    timestamp += 15 * 60 * 1000 // Add 15 minutes
  }

  // Sort by time to ensure ascending order
  return data.sort((a, b) => a.time - b.time)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'EURUSD'
    const interval = searchParams.get('interval') || '15m'
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('📈 Fetching forex data...')
    console.log('   Symbol:', symbol)
    console.log('   Interval:', interval)
    console.log('   Limit:', limit)

    // Validate symbol
    if (!FOREX_SYMBOLS[symbol]) {
      console.warn(`⚠️ Unknown symbol: ${symbol}, using EURUSD as default`)
    }

    const symbolInfo = FOREX_SYMBOLS[symbol] || FOREX_SYMBOLS['EURUSD']

    // Check if we should use real API or mock data
    const useRealAPI = ALPHA_VANTAGE_API_KEY && ALPHA_VANTAGE_API_KEY !== 'demo' && ALPHA_VANTAGE_API_KEY.length > 10

    if (useRealAPI) {
      try {
        console.log('🌐 Fetching from Alpha Vantage API...')

        // Alpha Vantage Forex API - Daily data only
        const avUrl = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${symbolInfo.from}&to_symbol=${symbolInfo.to}&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=compact`

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        const response = await fetch(avUrl, { signal: controller.signal })
        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`Alpha Vantage API error: ${response.status}`)
        }

        const text = await response.text()

        // Check rate limit or error messages
        if (text.includes('Thank you for using Alpha Vantage')) {
          console.warn('⚠️ Alpha Vantage rate limit reached')
          throw new Error('Rate limit exceeded')
        }

        const data = JSON.parse(text)

        if (data['Error Message']) {
          console.warn('Alpha Vantage returned error:', data['Error Message'])
          throw new Error(data['Error Message'])
        }

        if (!data['Time Series FX (Daily)']) {
          console.warn('⚠️ No Time Series data from Alpha Vantage')
          throw new Error('No data available')
        }

        // Transform Alpha Vantage data to OHLC format
        const timeSeries = data['Time Series FX (Daily)']
        const ohlcData = Object.entries(timeSeries)
          .slice(0, limit)
          .reverse() // Alpha Vantage returns newest first
          .map(([date, values]: [string, any]) => {
            const timestamp = new Date(date).getTime() / 1000
            const open = parseFloat(values['1. open'])
            const high = parseFloat(values['2. high'])
            const low = parseFloat(values['3. low'])
            const close = parseFloat(values['4. close'])

            return {
              time: Math.floor(timestamp),
              open: isNaN(open) ? 0 : open,
              high: isNaN(high) ? 0 : high,
              low: isNaN(low) ? 0 : low,
              close: isNaN(close) ? 0 : close,
            }
          })
          .filter((kline) => {
            // Filter invalid data
            return (
              kline.time > 0 &&
              kline.high >= kline.low &&
              !isNaN(kline.open) &&
              !isNaN(kline.high) &&
              !isNaN(kline.low) &&
              !isNaN(kline.close)
            )
          })
          .sort((a, b) => a.time - b.time) // Ensure ascending order

        console.log(`✅ Fetched ${ohlcData.length} candles from Alpha Vantage`)

        return NextResponse.json({
          success: true,
          symbol,
          interval,
          data: ohlcData,
          source: 'alphavantage',
        })
      } catch (avError: any) {
        console.warn('⚠️ Alpha Vantage API failed:', avError.message)
        console.log('🎲 Falling back to mock data...')

        // Fallback to mock data
        const mockData = generateMockForexData(symbol, limit)

        return NextResponse.json({
          success: true,
          symbol,
          interval,
          data: mockData,
          source: 'mock',
          note: avError.message,
        })
      }
    } else {
      // Use mock data (no API key provided)
      console.log('🎲 Using mock forex data (no API key)')

      const mockData = generateMockForexData(symbol, limit)

      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: mockData,
        source: 'mock',
        note: 'Set ALPHA_VANTAGE_API_KEY in .env for real data',
      })
    }
  } catch (error) {
    console.error('❌ Error fetching forex data:', error)

    // Final fallback - always return mock data
    const symbol = new URL(request.url).searchParams.get('symbol') || 'EURUSD'
    const mockData = generateMockForexData(symbol, 50)

    return NextResponse.json(
      {
        success: true,
        symbol,
        interval: '15m',
        data: mockData,
        source: 'mock-fallback',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
