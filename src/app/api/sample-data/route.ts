import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

const SAMPLE_TRADES = [
  { symbol: 'EUR/USD', type: 'BUY', open_price: 1.0842, close_price: 1.0891, lot_size: 0.1, profit_loss: 49.00, session: 'London', emotion: 'Calm', setup_type: 'Trend Continuation', risk_reward_ratio: 2.1, trade_duration: 45 },
  { symbol: 'GBP/USD', type: 'SELL', open_price: 1.2735, close_price: 1.2701, lot_size: 0.05, profit_loss: 17.00, session: 'London', emotion: 'Calm', setup_type: 'Range Reversal', risk_reward_ratio: 1.5, trade_duration: 30 },
  { symbol: 'XAU/USD', type: 'BUY', open_price: 2338.50, close_price: 2325.80, lot_size: 0.02, profit_loss: -25.40, session: 'New York', emotion: 'FOMO', setup_type: 'Breakout', risk_reward_ratio: 1.0, trade_duration: 60 },
  { symbol: 'USD/JPY', type: 'SELL', open_price: 154.32, close_price: 153.85, lot_size: 0.1, profit_loss: 47.00, session: 'Tokyo', emotion: 'Calm', setup_type: 'Trend Continuation', risk_reward_ratio: 2.3, trade_duration: 90 },
  { symbol: 'EUR/GBP', type: 'BUY', open_price: 0.8520, close_price: 0.8548, lot_size: 0.1, profit_loss: 28.00, session: 'London', emotion: 'Calm', setup_type: 'Range Reversal', risk_reward_ratio: 1.8, trade_duration: 35 },
  { symbol: 'AUD/USD', type: 'BUY', open_price: 0.6540, close_price: 0.6522, lot_size: 0.05, profit_loss: -9.00, session: 'Sydney', emotion: 'Impatient', setup_type: 'Trend Continuation', risk_reward_ratio: 0.8, trade_duration: 15 },
  { symbol: 'GBP/JPY', type: 'SELL', open_price: 188.45, close_price: 187.90, lot_size: 0.05, profit_loss: 27.50, session: 'London', emotion: 'Calm', setup_type: 'Trend Reversal', risk_reward_ratio: 2.0, trade_duration: 55 },
  { symbol: 'EUR/USD', type: 'SELL', open_price: 1.0875, close_price: 1.0912, lot_size: 0.1, profit_loss: -37.00, session: 'New York', emotion: 'FOMO', setup_type: 'Breakout', risk_reward_ratio: 0.7, trade_duration: 20 },
  { symbol: 'XAU/USD', type: 'BUY', open_price: 2340.20, close_price: 2358.50, lot_size: 0.02, profit_loss: 36.60, session: 'London', emotion: 'Calm', setup_type: 'Breakout', risk_reward_ratio: 2.5, trade_duration: 120 },
  { symbol: 'USD/CHF', type: 'SELL', open_price: 0.8920, close_price: 0.8875, lot_size: 0.1, profit_loss: 45.00, session: 'London', emotion: 'Calm', setup_type: 'Trend Continuation', risk_reward_ratio: 2.2, trade_duration: 70 },
  { symbol: 'EUR/USD', type: 'BUY', open_price: 1.0860, close_price: 1.0885, lot_size: 0.05, profit_loss: 12.50, session: 'London', emotion: 'Calm', setup_type: 'Range Reversal', risk_reward_ratio: 1.6, trade_duration: 25 },
  { symbol: 'GBP/USD', type: 'BUY', open_price: 1.2690, close_price: 1.2745, lot_size: 0.1, profit_loss: 55.00, session: 'New York', emotion: 'Calm', setup_type: 'Trend Continuation', risk_reward_ratio: 2.8, trade_duration: 80 },
  { symbol: 'USD/JPY', type: 'BUY', open_price: 154.10, close_price: 153.70, lot_size: 0.05, profit_loss: -20.00, session: 'Tokyo', emotion: 'Impatient', setup_type: 'Range Reversal', risk_reward_ratio: 0.6, trade_duration: 10 },
  { symbol: 'AUD/USD', type: 'SELL', open_price: 0.6555, close_price: 0.6510, lot_size: 0.1, profit_loss: 45.00, session: 'Sydney', emotion: 'Calm', setup_type: 'Trend Reversal', risk_reward_ratio: 2.4, trade_duration: 65 },
  { symbol: 'XAU/USD', type: 'SELL', open_price: 2355.00, close_price: 2348.30, lot_size: 0.02, profit_loss: 13.40, session: 'London', emotion: 'Calm', setup_type: 'Range Reversal', risk_reward_ratio: 1.9, trade_duration: 40 },
]

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.id

    // Check if user already has trades
    const existingCount = await db.trade.count({ where: { user_id: userId } })
    if (existingCount > 0) {
      return NextResponse.json({ error: 'You already have trades. Sample data is only for empty accounts.' }, { status: 400 })
    }

    // Generate realistic dates over the past 15 days
    const now = new Date()
    const trades = SAMPLE_TRADES.map((t, i) => {
      const daysAgo = Math.floor(i * 15 / SAMPLE_TRADES.length)
      const hoursOffset = Math.floor(Math.random() * 8) + 1
      const openTime = new Date(now)
      openTime.setDate(openTime.getDate() - daysAgo)
      openTime.setHours(8 + hoursOffset, Math.floor(Math.random() * 30), 0, 0)

      const closeTime = new Date(openTime)
      closeTime.setMinutes(closeTime.getMinutes() + t.trade_duration || 30)

      return {
        user_id: userId,
        symbol: t.symbol,
        type: t.type,
        open_price: t.open_price,
        close_price: t.close_price,
        lot_size: t.lot_size,
        profit_loss: t.profit_loss,
        open_time: openTime,
        close_time: closeTime,
        session: t.session,
        emotion: t.emotion,
        setup_type: t.setup_type,
        risk_reward_ratio: t.risk_reward_ratio,
        trade_duration: t.trade_duration,
      }
    })

    // Insert all sample trades
    const result = await db.trade.createMany({ data: trades })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Sample data error:', error)
    return NextResponse.json({ error: 'Failed to load sample data' }, { status: 500 })
  }
}