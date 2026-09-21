import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { db } from '@/lib/db'

// Demo trade data for tutorial
const demoTrades = [
  {
    user_id: '',
    symbol: 'XAUUSD',
    type: 'BUY',
    open_price: 2045.50,
    close_price: 2058.30,
    lot_size: 0.1,
    profit_loss: 127.80,
    open_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    session: 'London',
    notes: 'Golden cross setup with 20 EMA bounce',
    stop_loss: 2040.00,
    take_profit: 2065.00,
    risk_reward_ratio: 2.5,
    trade_duration: 7200,
    setup_type: 'Trend Following'
  },
  {
    user_id: '',
    symbol: 'EURUSD',
    type: 'SELL',
    open_price: 1.0890,
    close_price: 1.0925,
    lot_size: 0.15,
    profit_loss: -52.50,
    open_time: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
    session: 'New York',
    notes: 'FOMO entry after seeing green candles - no setup',
    stop_loss: 1.0910,
    take_profit: 1.0850,
    risk_reward_ratio: 0.8,
    trade_duration: 2700,
    setup_type: 'Counter Trend'
  },
  {
    user_id: '',
    symbol: 'GBPJPY',
    type: 'BUY',
    open_price: 188.50,
    close_price: 189.25,
    lot_size: 0.1,
    profit_loss: 75.00,
    open_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
    session: 'London',
    notes: 'Breakout retest at 188.40 support',
    stop_loss: 188.00,
    take_profit: 189.80,
    risk_reward_ratio: 2.0,
    trade_duration: 10800,
    setup_type: 'Breakout'
  },
  {
    user_id: '',
    symbol: 'XAUUSD',
    type: 'SELL',
    open_price: 2055.00,
    close_price: 2048.50,
    lot_size: 0.12,
    profit_loss: 78.00,
    open_time: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000).toISOString(),
    session: 'Asian',
    notes: 'Supply zone rejection with bearish engulfing',
    stop_loss: 2058.00,
    take_profit: 2042.00,
    risk_reward_ratio: 1.5,
    trade_duration: 5400,
    setup_type: 'Range Trading'
  },
  {
    user_id: '',
    symbol: 'EURJPY',
    type: 'BUY',
    open_price: 158.20,
    close_price: 157.85,
    lot_size: 0.1,
    profit_loss: -35.00,
    open_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    session: 'London',
    notes: 'Entered before US CPI release - bad timing',
    stop_loss: 157.90,
    take_profit: 158.80,
    risk_reward_ratio: 1.2,
    trade_duration: 1800,
    setup_type: 'Momentum'
  },
  {
    user_id: '',
    symbol: 'USDJPY',
    type: 'BUY',
    open_price: 149.80,
    close_price: 150.35,
    lot_size: 0.2,
    profit_loss: 110.00,
    open_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
    session: 'New York',
    notes: 'Bank intervention support at 149.75',
    stop_loss: 149.60,
    take_profit: 150.80,
    risk_reward_ratio: 2.0,
    trade_duration: 14400,
    setup_type: 'Support/Resistance'
  },
  {
    user_id: '',
    symbol: 'XAUUSD',
    type: 'BUY',
    open_price: 2040.00,
    close_price: 2033.50,
    lot_size: 0.15,
    profit_loss: -97.50,
    open_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000).toISOString(),
    session: 'London',
    notes: 'Over-leveraged on gold without news',
    stop_loss: 2035.00,
    take_profit: 2050.00,
    risk_reward_ratio: 1.0,
    trade_duration: 3000,
    setup_type: 'Counter Trend'
  },
  {
    user_id: '',
    symbol: 'GBPUSD',
    type: 'SELL',
    open_price: 1.2650,
    close_price: 1.2615,
    lot_size: 0.18,
    profit_loss: 63.00,
    open_time: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    session: 'New York',
    notes: 'Double top rejection at 1.2655',
    stop_loss: 1.2670,
    take_profit: 1.2600,
    risk_reward_ratio: 1.8,
    trade_duration: 14400,
    setup_type: 'Reversal'
  },
  {
    user_id: '',
    symbol: 'XAUUSD',
    type: 'BUY',
    open_price: 2038.00,
    close_price: 2045.50,
    lot_size: 0.2,
    profit_loss: 150.00,
    open_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    session: 'London',
    notes: 'Dollar weakness support at 2035',
    stop_loss: 2035.00,
    take_profit: 2050.00,
    risk_reward_ratio: 2.0,
    trade_duration: 10800,
    setup_type: 'Trend Following'
  },
  {
    user_id: '',
    symbol: 'EURUSD',
    type: 'BUY',
    open_price: 1.0845,
    close_price: 1.0890,
    lot_size: 0.25,
    profit_loss: 112.50,
    open_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    close_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    session: 'London',
    notes: 'Bullish flag breakout with volume',
    stop_loss: 1.0830,
    take_profit: 1.0910,
    risk_reward_ratio: 1.5,
    trade_duration: 5400,
    setup_type: 'Continuation'
  }
]

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user already has demo data
    const existingTrades = await db.trade.findMany({
      where: {
        user_id: user.id,
        notes: { contains: '[DEMO DATA]' }
      }
    })

    if (existingTrades.length > 0) {
      return NextResponse.json({
        error: 'Demo data already loaded',
        message: 'Clear demo data first if you want to reload'
      }, { status: 400 })
    }

    // Insert demo trades
    const tradesToInsert = demoTrades.map(trade => ({
      ...trade,
      user_id: user.id,
      notes: `[DEMO DATA] ${trade.notes}`
    }))

    await db.trade.createMany({
      data: tradesToInsert
    })

    return NextResponse.json({
      success: true,
      message: `Loaded ${tradesToInsert.length} demo trades`,
      tradesLoaded: tradesToInsert.length
    })
  } catch (error) {
    console.error('[Load Demo Data] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
