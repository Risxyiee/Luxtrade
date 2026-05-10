import { NextRequest, NextResponse } from 'next/server'

// Forex symbols for Alpha Vantage API
const FOREX_SYMBOLS: Record<string, string> = {
  'XAUUSD': 'XAU',  // Gold
  'XAGUSD': 'XAG',  // Silver
  'EURUSD': 'EUR',
  'GBPUSD': 'GBP',
  'USDJPY': 'JPY',
  'EURGBP': 'GBP',
  'EURJPY': 'JPY',
  'GBPJPY': 'JPY',
  'AUDUSD': 'AUD',
  'NZDUSD': 'NZD',
  'USDCAD': 'CAD',
  'USDCHF': 'CHF',
}

// Alpha Vantage API (Free tier - 25 requests/day)
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo'

// Fallback to mock data if no API key or rate limit
function generateMockData(baseCurrency: string, count: number = 150) {
  const data = []
  let timestamp = Date.now() - (count * 15 * 60 * 1000) // Start from 15 min ago
  let basePrice = 0

  // Set base price based on currency
  switch (baseCurrency) {
    case 'XAU':
      basePrice = 2350.00
      break
    case 'XAG':
      basePrice = 28.50
      break
    case 'EUR':
      basePrice = 1.0850
      break
    case 'GBP':
      basePrice = 1.2650
      break
    case 'JPY':
      basePrice = 148.50
      break
    case 'AUD':
      basePrice = 0.6550
      break
    case 'NZD':
      basePrice = 0.6120
      break
    case 'CAD':
      basePrice = 1.3650
      break
    case 'CHF':
      basePrice = 0.8950
      break
    default:
      basePrice = 1.0000
  }

  for (let i = 0; i < count; i++) {
    // Generate realistic OHLC data
    const volatility = basePrice * 0.002 // 0.2% volatility
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

  return data
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'EURUSD'
    const interval = searchParams.get('interval') || '15m'
    const limit = parseInt(searchParams.get('limit') || '150')

    console.log('📈 Fetching forex data...')
    console.log('   Symbol:', symbol)
    console.log('   Interval:', interval)
    console.log('   Limit:', limit)
    console.log('   API Key:', ALPHA_VANTAGE_API_KEY ? 'Provided' : 'Using demo data')

    // Check if we should use real API or mock data
    const useRealAPI = ALPHA_VANTAGE_API_KEY && ALPHA_VANTAGE_API_KEY !== 'demo'

    if (useRealAPI) {
      // Try Alpha Vantage API
      const fromCurrency = FOREX_SYMBOLS[symbol]

      if (!fromCurrency) {
        throw new Error(`Invalid forex symbol: ${symbol}`)
      }

      // Alpha Vantage Forex API
      // Note: Alpha Vantage returns daily data, so we'll need to adjust
      const avUrl = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${fromCurrency}&to_symbol=USD&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=compact`

      console.log('   Fetching from Alpha Vantage...')
      const response = await fetch(avUrl)

      if (!response.ok) {
        console.warn('Alpha Vantage API failed, using mock data')
        return NextResponse.json({
          success: true,
          symbol,
          interval,
          data: generateMockData(fromCurrency, limit),
          source: 'mock'
        })
      }

      const text = await response.text()

      try {
        const data = JSON.parse(text)

        if (data['Error Message']) {
          console.warn('Alpha Vantage returned error:', data['Error Message'])
          console.log('   Falling back to mock data...')

          return NextResponse.json({
            success: true,
            symbol,
            interval,
            data: generateMockData(fromCurrency, limit),
            source: 'mock'
          })
        }

        if (!data['Time Series FX (Daily)']) {
          console.warn('No data returned from Alpha Vantage')
          console.log('   Falling back to mock data...')

          return NextResponse.json({
            success: true,
            symbol,
            interval,
            data: generateMockData(fromCurrency, limit),
            source: 'mock'
          })
        }

        // Transform Alpha Vantage data to OHLC format
        const timeSeries = data['Time Series FX (Daily)']
        const ohlcData = Object.entries(timeSeries)
          .slice(0, limit)
          .reverse() // Alpha Vantage returns newest first
          .map(([date, values]: [string, any]) => {
            const timestamp = new Date(date).getTime() / 1000
            return {
              time: Math.floor(timestamp),
              open: parseFloat(values['1. open']),
              high: parseFloat(values['2. high']),
              low: parseFloat(values['3. low']),
              close: parseFloat(values['4. close']),
            }
          })

        console.log(`✅ Fetched ${ohlcData.length} candles from Alpha Vantage`)

        return NextResponse.json({
          success: true,
          symbol,
          interval,
          data: ohlcData,
          source: 'alphavantage'
        })
      } catch (parseError) {
        console.error('Error parsing Alpha Vantage response:', parseError)
        console.log('   Falling back to mock data...')

        return NextResponse.json({
          success: true,
          symbol,
          interval,
          data: generateMockData(fromCurrency, limit),
          source: 'mock'
        })
      }
    } else {
      // Use mock data (no API key provided)
      console.log('🎲 Using mock forex data (no API key)')
      const fromCurrency = FOREX_SYMBOLS[symbol] || 'EUR'

      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: generateMockData(fromCurrency, limit),
        source: 'mock',
        note: 'Set ALPHA_VANTAGE_API_KEY in .env for real data'
      })
    }
  } catch (error) {
    console.error('❌ Error fetching forex data:', error)

    // Fallback to mock data on error
    const symbol = new URL(request.url).searchParams.get('symbol') || 'EURUSD'
    const fromCurrency = FOREX_SYMBOLS[symbol] || 'EUR'

    return NextResponse.json(
      {
        success: true,
        symbol,
        interval: '15m',
        data: generateMockData(fromCurrency, 150),
        source: 'mock-fallback',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
