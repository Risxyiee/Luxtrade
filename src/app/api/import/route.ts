import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const trades = body.trades
    
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: 'No trades provided' }, { status: 400 })
    }
    
    // Transform trades for database
    const tradesToInsert = trades.map((trade: {
      symbol: string;
      type: string;
      open_price: number;
      close_price: number;
      lot_size: number;
      profit_loss: number;
      open_time: string;
      close_time: string;
      session: string | null;
    }) => ({
      user_id: 'demo-user', // TODO: Get from auth when implemented
      symbol: trade.symbol.toUpperCase(),
      type: trade.type, // BUY or SELL
      open_price: parseFloat(String(trade.open_price)) || 0,
      close_price: parseFloat(String(trade.close_price)) || 0,
      lot_size: parseFloat(String(trade.lot_size)) || 0.01,
      profit_loss: parseFloat(String(trade.profit_loss)) || 0,
      open_time: trade.open_time || new Date().toISOString(),
      close_time: trade.close_time || new Date().toISOString(),
      session: trade.session || null,
    }))
    
    // Insert trades in batches of 100
    const batchSize = 100
    let inserted = 0
    const errors: string[] = []
    
    for (let i = 0; i < tradesToInsert.length; i += batchSize) {
      const batch = tradesToInsert.slice(i, i + batchSize)
      const { error } = await supabase
        .from('trades')
        .insert(batch)
      
      if (error) {
        console.error('Batch insert error:', error)
        errors.push(error.message)
      } else {
        inserted += batch.length
      }
    }
    
    if (inserted === 0 && errors.length > 0) {
      // Check if table doesn't exist
      if (errors[0].includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Database table not found. Please run the SQL schema first.',
          needsSetup: true 
        }, { status: 500 })
      }
      return NextResponse.json({ error: errors[0] }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      inserted,
      total: trades.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Failed to import trades' }, { status: 500 })
  }
}
