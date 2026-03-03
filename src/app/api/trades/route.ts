import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch all trades
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const userId = searchParams.get('userId')
    
    let query = supabase
      .from('trades')
      .select('*')
      .order('close_time', { ascending: false })
      .limit(limit)
    
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    
    if (error) {
      // Table doesn't exist yet - return empty array
      if (error.message.includes('does not exist') || error.message.includes('column')) {
        return NextResponse.json({ trades: [] })
      }
      console.error('Trades fetch error:', error)
      return NextResponse.json({ trades: [] })
    }
    
    return NextResponse.json({ trades: data || [] })
  } catch (err) {
    console.error('Trades API error:', err)
    return NextResponse.json({ trades: [] })
  }
}

// POST - Create new trade
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const tradeData = {
      user_id: body.user_id || 'demo-user',
      symbol: body.symbol.toUpperCase(),
      type: body.type, // BUY or SELL
      open_price: parseFloat(body.open_price),
      close_price: parseFloat(body.close_price) || 0,
      lot_size: parseFloat(body.lot_size) || 0.01,
      profit_loss: parseFloat(body.profit_loss) || 0,
      open_time: body.open_time || new Date().toISOString(),
      close_time: body.close_time || new Date().toISOString(),
      session: body.session || null,
    }
    
    const { data, error } = await supabase
      .from('trades')
      .insert([tradeData])
      .select()
      .single()
    
    if (error) {
      console.error('Trade create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ trade: data })
  } catch (err) {
    console.error('Trade create error:', err)
    return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 })
  }
}

// PUT - Update trade
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    
    const { data, error } = await supabase
      .from('trades')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ trade: data })
  } catch {
    return NextResponse.json({ error: 'Failed to update trade' }, { status: 500 })
  }
}

// DELETE - Delete trade
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 })
    }
    
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete trade' }, { status: 500 })
  }
}
