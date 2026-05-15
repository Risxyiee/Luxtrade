import { NextRequest, NextResponse } from 'next/server'

// Mock data generator for fallback
function generateMockData(symbol: string, count: number = 50) {
  const data = []
  let timestamp = Date.now() - (count * 15 * 60 * 1000) // Start from count*15min ago
  let basePrice = 0

  // Set base price based on symbol
  if (symbol.includes('BTC')) {
    basePrice = 80000 + Math.random() * 5000
  } else if (symbol.includes('ETH')) {
    basePrice = 3000 + Math.random() * 500
  } else if (symbol.includes('BNB')) {
    basePrice = 600 + Math.random() * 100
  } else if (symbol.includes('SOL')) {
    basePrice = 150 + Math.random() * 50
  } else if (symbol.includes('XRP')) {
    basePrice = 2.5 + Math.random() * 0.5
  } else if (symbol.includes('DOGE')) {
    basePrice = 0.15 + Math.random() * 0.05
  } else if (symbol.includes('ADA')) {
    basePrice = 1.0 + Math.random() * 0.2
  } else {
    // Default for other crypto
    basePrice = 100 + Math.random() * 50
  }

  for (let i = 0; i < count; i++) {
    // Generate realistic OHLC data
    const volatility = basePrice * 0.003 // 0.3% volatility for crypto
    const open = basePrice
    const high = basePrice + Math.random() * volatility
    const low = basePrice - Math.random() * volatility
    const close = basePrice + (Math.random() - 0.5) * volatility

    data.push({
      time: Math.floor(timestamp / 1000), // Convert to seconds
      open: parseFloat(open.toFixed(8)),
      high: parseFloat(high.toFixed(8)),
      low: parseFloat(low.toFixed(8)),
      close: parseFloat(close.toFixed(8)),
      volume: parseFloat((Math.random() * 1000).toFixed(2)),
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
    const symbol = searchParams.get('symbol') || 'BTCUSDT'
    const interval = searchParams.get('interval') || '15m'
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('📈 Fetching klines from Binance...')
    console.log('   Symbol:', symbol)
    console.log('   Interval:', interval)
    console.log('   Limit:', limit)

    // Fetch OHLC data from Binance with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    let response, data

    try {
      response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`)
      }

      data = await response.json()

      console.log('[API klines] Raw data from Binance:', data ? `${data.length} items` : 'null')

      // Transform Binance data to OHLC format
      // Binance returns: [time, open, high, low, close, volume, ...]
      const ohlcData = (Array.isArray(data) ? data : [])
        .map((kline: any[]) => ({
          time: Math.floor(kline[0] / 1000), // Convert to seconds
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[5]),
        }))
        .filter((kline) => {
          // Filter invalid data
          const isValidTime = typeof kline.time === 'number' && kline.time > 0
          const isValidOHLC =
            typeof kline.open === 'number' &&
            typeof kline.high === 'number' &&
            typeof kline.low === 'number' &&
            typeof kline.close === 'number' &&
            kline.high >= kline.low
          return isValidTime && isValidOHLC
        })
        .sort((a, b) => a.time - b.time) // Ensure ascending order

      console.log(`✅ Fetched ${ohlcData.length} candles from Binance`)

      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: ohlcData,
        source: 'binance',
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      console.warn('⚠️ Binance API failed:', fetchError.message)
      console.log('🎲 Falling back to mock data...')

      // Fallback to mock data
      const mockData = generateMockData(symbol, limit)
      console.log(`✅ Generated ${mockData.length} mock candles`)

      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: mockData,
        source: 'mock',
        note: fetchError.message,
      })
    }
  } catch (error) {
    console.error('❌ Error fetching klines:', error)

    // Final fallback - always return mock data
    const symbol = new URL(request.url).searchParams.get('symbol') || 'BTCUSDT'
    const mockData = generateMockData(symbol, 50)

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
