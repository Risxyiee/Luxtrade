import { NextRequest, NextResponse } from 'next/server'
import { fetchServerCandles } from '@/lib/market/server-candles'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'BTCUSDT'
    const interval = searchParams.get('interval') || '1h'
    const limit = searchParams.get('limit') || '150'

    console.log('🎯 Calculating Luxtrade indicators...')
    console.log('   Symbol:', symbol)
    console.log('   Interval:', interval)
    console.log('   Limit:', limit)

    // Fetch OHLC via rantai server Luxtradee (TradingView → Finnhub →
    // TwelveData → Yahoo) — BINANCE DIBUANG (keputusan Bos)
    const cd = await fetchServerCandles(symbol.toUpperCase(), interval, Math.min(parseInt(limit) || 150, 500))
    if (!cd || !cd.bars.length) {
      throw new Error('Data candle tidak tersedia dari semua sumber')
    }
    const ohlcData = cd.bars

    console.log(`   Fetched ${ohlcData.length} candles`)

    // Calculate indicators for each candle (starting from index 2)
    const signals: any[] = []

    for (let i = 2; i < ohlcData.length; i++) {
      const current = ohlcData[i]
      const prev1 = ohlcData[i - 1]
      const prev2 = ohlcData[i - 2]

      // Lookback high = max of previous 2 candles' high
      const lookbackHigh = Math.max(prev1.high, prev2.high)

      // Lookback low = min of previous 2 candles' low
      const lookbackLow = Math.min(prev1.low, prev2.low)

      // Body percent = body size / candle size * 100
      const highLowRange = current.high - current.low
      const bodySize = Math.abs(current.close - current.open)

      let bodyPercent = 0
      if (highLowRange > 0) {
        bodyPercent = (bodySize / highLowRange) * 100
      }

      // BUY Signal: Close > lookbackHigh AND bodyPercent >= 80 AND Close > Open (bullish)
      const isBuy =
        current.close > lookbackHigh &&
        bodyPercent >= 80 &&
        current.close > current.open

      // SELL Signal: Close < lookbackLow AND bodyPercent >= 80 AND Close < Open (bearish)
      const isSell =
        current.close < lookbackLow &&
        bodyPercent >= 80 &&
        current.close < current.open

      if (isBuy || isSell) {
        signals.push({
          time: current.time,
          type: isBuy ? 'BUY' : 'SELL',
          price: isBuy ? current.low : current.high, // BUY marker above, SELL marker below
          bodyPercent: bodyPercent.toFixed(2),
          lookbackHigh: lookbackHigh.toFixed(2),
          lookbackLow: lookbackLow.toFixed(2)
        })
      }
    }

    console.log(`✅ Generated ${signals.length} signals`)
    console.log(`   BUY signals: ${signals.filter(s => s.type === 'BUY').length}`)
    console.log(`   SELL signals: ${signals.filter(s => s.type === 'SELL').length}`)

    return NextResponse.json({
      success: true,
      symbol,
      interval,
      klines: ohlcData,
      signals
    })
  } catch (error) {
    console.error('❌ Error calculating indicators:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate indicators',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
