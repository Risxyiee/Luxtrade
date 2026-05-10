import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'BTCUSDT'
    const interval = searchParams.get('interval') || '15m'
    const limit = searchParams.get('limit') || '150'

    console.log('📈 Fetching klines from Binance...')
    console.log('   Symbol:', symbol)
    console.log('   Interval:', interval)
    console.log('   Limit:', limit)

    // Fetch OHLC data from Binance
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    )

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform Binance data to OHLC format
    // Binance returns: [time, open, high, low, close, volume, ...]
    const ohlcData = data.map((kline: any[]) => ({
      time: Math.floor(kline[0] / 1000), // Convert to seconds
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    }))

    console.log(`✅ Fetched ${ohlcData.length} candles`)

    return NextResponse.json({
      success: true,
      symbol,
      interval,
      data: ohlcData
    })
  } catch (error) {
    console.error('❌ Error fetching klines:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch klines',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
