import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Sample trading data for demo
const SAMPLE_TRADES = [
  // Winning trades
  { symbol: 'EURUSD', type: 'BUY', open_price: 1.0850, close_price: 1.0890, lot_size: 0.1, profit_loss: 400, session: 'London' },
  { symbol: 'GBPUSD', type: 'SELL', open_price: 1.2650, close_price: 1.2610, lot_size: 0.1, profit_loss: 400, session: 'London' },
  { symbol: 'XAUUSD', type: 'BUY', open_price: 1985.00, close_price: 1995.00, lot_size: 0.1, profit_loss: 1000, session: 'New York' },
  { symbol: 'USDJPY', type: 'SELL', open_price: 149.50, close_price: 149.20, lot_size: 0.2, profit_loss: 400, session: 'Asia' },
  { symbol: 'EURUSD', type: 'BUY', open_price: 1.0820, close_price: 1.0860, lot_size: 0.15, profit_loss: 600, session: 'New York' },
  { symbol: 'GBPJPY', type: 'SELL', open_price: 188.50, close_price: 188.00, lot_size: 0.1, profit_loss: 333, session: 'London' },
  { symbol: 'AUDUSD', type: 'BUY', open_price: 0.6520, close_price: 0.6560, lot_size: 0.2, profit_loss: 800, session: 'Asia' },
  { symbol: 'XAUUSD', type: 'SELL', open_price: 2005.00, close_price: 1995.00, lot_size: 0.05, profit_loss: 500, session: 'New York' },
  { symbol: 'EURGBP', type: 'BUY', open_price: 0.8570, close_price: 0.8610, lot_size: 0.1, profit_loss: 465, session: 'London' },
  { symbol: 'USDCHF', type: 'SELL', open_price: 0.8850, close_price: 0.8820, lot_size: 0.1, profit_loss: 340, session: 'London' },
  
  // Losing trades
  { symbol: 'EURUSD', type: 'SELL', open_price: 1.0880, close_price: 1.0920, lot_size: 0.1, profit_loss: -400, session: 'New York' },
  { symbol: 'GBPUSD', type: 'BUY', open_price: 1.2620, close_price: 1.2580, lot_size: 0.1, profit_loss: -400, session: 'London' },
  { symbol: 'XAUUSD', type: 'SELL', open_price: 1975.00, close_price: 1985.00, lot_size: 0.1, profit_loss: -1000, session: 'Asia' },
  { symbol: 'USDJPY', type: 'BUY', open_price: 149.20, close_price: 149.50, lot_size: 0.15, profit_loss: -300, session: 'New York' },
  { symbol: 'EURUSD', type: 'SELL', open_price: 1.0850, close_price: 1.0870, lot_size: 0.1, profit_loss: -200, session: 'London' },
  { symbol: 'AUDUSD', type: 'SELL', open_price: 0.6550, close_price: 0.6580, lot_size: 0.1, profit_loss: -300, session: 'Asia' },
  { symbol: 'GBPJPY', type: 'BUY', open_price: 188.00, close_price: 188.40, lot_size: 0.1, profit_loss: -267, session: 'London' },
  { symbol: 'XAUUSD', type: 'BUY', open_price: 1990.00, close_price: 1980.00, lot_size: 0.05, profit_loss: -500, session: 'Off-Market' },
  
  // More winning trades
  { symbol: 'EURUSD', type: 'BUY', open_price: 1.0800, close_price: 1.0840, lot_size: 0.2, profit_loss: 800, session: 'London' },
  { symbol: 'USDJPY', type: 'SELL', open_price: 150.00, close_price: 149.50, lot_size: 0.1, profit_loss: 333, session: 'New York' },
  { symbol: 'GBPUSD', type: 'SELL', open_price: 1.2700, close_price: 1.2650, lot_size: 0.15, profit_loss: 750, session: 'London' },
  { symbol: 'XAUUSD', type: 'BUY', open_price: 1965.00, close_price: 1980.00, lot_size: 0.1, profit_loss: 1500, session: 'New York' },
  { symbol: 'EURUSD', type: 'SELL', open_price: 1.0900, close_price: 1.0860, lot_size: 0.1, profit_loss: 400, session: 'Asia' },
  { symbol: 'AUDUSD', type: 'BUY', open_price: 0.6480, close_price: 0.6520, lot_size: 0.2, profit_loss: 800, session: 'Asia' },
  
  // More losing trades  
  { symbol: 'EURUSD', type: 'BUY', open_price: 1.0870, close_price: 1.0840, lot_size: 0.1, profit_loss: -300, session: 'Off-Market' },
  { symbol: 'GBPUSD', type: 'SELL', open_price: 1.2600, close_price: 1.2640, lot_size: 0.1, profit_loss: -400, session: 'New York' },
]

export async function POST() {
  try {
    // Generate dates for the past 30 days
    const now = new Date()
    const tradesWithDates = SAMPLE_TRADES.map((trade, index) => {
      // Spread trades across past 30 days
      const daysAgo = Math.floor(index * 1.2)
      const closeDate = new Date(now)
      closeDate.setDate(closeDate.getDate() - daysAgo)
      closeDate.setHours(10 + (index % 8), 30, 0, 0) // Random time during market hours
      
      const openDate = new Date(closeDate)
      openDate.setHours(openDate.getHours() - 2 - (index % 6)) // Open 2-8 hours before close
      
      return {
        user_id: 'demo-user',
        symbol: trade.symbol,
        type: trade.type,
        open_price: trade.open_price,
        close_price: trade.close_price,
        lot_size: trade.lot_size,
        profit_loss: trade.profit_loss,
        open_time: openDate.toISOString(),
        close_time: closeDate.toISOString(),
        session: trade.session,
      }
    })
    
    // Clear existing demo trades first
    await supabase
      .from('trades')
      .delete()
      .eq('user_id', 'demo-user')
    
    // Insert sample trades
    const { data, error } = await supabase
      .from('trades')
      .insert(tradesWithDates)
      .select()
    
    if (error) {
      console.error('Seed error:', error)
      
      // Check if table doesn't exist
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Database table not found. Please create the trades table in Supabase first.',
          needsSetup: true,
          sql: getCreateTableSQL()
        }, { status: 500 })
      }
      
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Calculate totals
    const totalPL = tradesWithDates.reduce((sum, t) => sum + t.profit_loss, 0)
    const winningTrades = tradesWithDates.filter(t => t.profit_loss > 0).length
    
    return NextResponse.json({ 
      success: true, 
      message: `✅ ${data?.length || tradesWithDates.length} sample trades created!`,
      stats: {
        totalTrades: tradesWithDates.length,
        winningTrades,
        losingTrades: tradesWithDates.length - winningTrades,
        winRate: ((winningTrades / tradesWithDates.length) * 100).toFixed(1) + '%',
        totalPL: '$' + totalPL.toLocaleString(),
      }
    })
  } catch (err) {
    console.error('Seed error:', err)
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 })
  }
}

function getCreateTableSQL() {
  return `
-- Run this SQL in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  symbol TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  open_price NUMERIC(18,5) NOT NULL,
  close_price NUMERIC(18,5) NOT NULL,
  lot_size NUMERIC(10,2) DEFAULT 0.01,
  profit_loss NUMERIC(18,2) NOT NULL,
  open_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ NOT NULL,
  session TEXT CHECK (session IN ('London', 'New York', 'Asia', 'Off-Market')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (demo)
CREATE POLICY "Allow all for demo" ON trades FOR ALL USING (true);
`
}
