import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Free user trade limit - 15 trades per month
const FREE_TRADE_LIMIT = 15

// Helper: Get authenticated user from request
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        return { id: user.id, email: user.email || '' }
      }
    }
    return null
  } catch {
    return null
  }
}

// Helper: Check if user is PRO
async function isUserPro(userId: string): Promise<boolean> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_pro, subscription_until')
      .eq('id', userId)
      .single()
    
    if (error || !profile) return false
    
    // Check if subscription is still valid
    if (profile.is_pro && profile.subscription_until) {
      const until = new Date(profile.subscription_until)
      return until > new Date()
    }
    
    return false
  } catch {
    return false
  }
}

// Helper: Count user trades for current month only
async function countUserTrades(userId: string): Promise<number> {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfMonthISO = startOfMonth.toISOString()

    const { count, error } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('close_time', startOfMonthISO)

    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

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
    // Get authenticated user
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized - Please login' }, { status: 401 })
    }
    
    const userId = authUser.id
    const body = await request.json()
    
    // SERVER-SIDE LIMIT CHECK: Free users can only have 15 trades per month
    const isPro = await isUserPro(userId)
    if (!isPro) {
      const tradeCount = await countUserTrades(userId)
      if (tradeCount >= FREE_TRADE_LIMIT) {
        return NextResponse.json({
          error: `Pengguna Free dibatasi maksimal ${FREE_TRADE_LIMIT} jurnal transaksi per bulan. Upgrade ke PRO untuk akses UNLIMITED!`,
          code: 'TRADE_LIMIT_EXCEEDED',
          limit: FREE_TRADE_LIMIT,
          current: tradeCount,
          requiresUpgrade: true
        }, { status: 403 })
      }
    }
    
    const tradeData = {
      user_id: userId,
      symbol: body.symbol.toUpperCase(),
      type: body.type, // BUY or SELL
      open_price: parseFloat(body.open_price),
      close_price: parseFloat(body.close_price) || 0,
      lot_size: parseFloat(body.lot_size) || 0.01,
      profit_loss: parseFloat(body.profit_loss) || 0,
      open_time: body.open_time || new Date().toISOString(),
      close_time: body.close_time || new Date().toISOString(),
      session: body.session || null,
      notes: body.notes || null,
      image_url: body.image_url || null,
      setup_type: body.setup_type || null,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      risk_reward_ratio: body.risk_reward_ratio ? parseFloat(body.risk_reward_ratio) : null,
      trade_duration: body.trade_duration ? parseInt(body.trade_duration) : null,
      linked_journal_id: body.linked_journal_id || null,
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
