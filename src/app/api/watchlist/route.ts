import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch watchlist
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      // Table doesn't exist yet
      if (error.message.includes('does not exist') || error.message.includes('Could not find')) {
        return NextResponse.json({ items: [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ items: data || [] })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

// POST - Add to watchlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('watchlist')
      .insert([{
        symbol: body.symbol.toUpperCase(),
        name: body.name || body.symbol.toUpperCase(),
        target_price: body.target_price ? parseFloat(body.target_price) : null,
        notes: body.notes || null,
      }])
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ item: data })
  } catch {
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })
  }
}

// DELETE - Remove from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }
    
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 })
  }
}
