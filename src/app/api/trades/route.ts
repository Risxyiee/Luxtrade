import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

// Helper: Ensure profile exists (auto-create if not)
async function ensureProfile(userId: string, email?: string): Promise<void> {
  try {
    const existing = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!existing) {
      console.log('📝 Auto-creating profile for user:', userId)
      await db.profile.create({
        data: {
          id: userId,
          email: email || null,
          plan: 'FREE',
          is_pro: false,
          role: 'USER',
          streakCount: 0,
          bestStreak: 0,
          achievements: '[]',
        }
      })
      console.log('✅ Profile created automatically')
    }
  } catch (error) {
    console.error('❌ Error creating profile:', error)
    throw error
  }
}

// Helper: Check if user is PRO
async function isUserPro(userId: string): Promise<boolean> {
  try {
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: { is_pro: true, subscription_until: true }
    })

    if (!profile) return false

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

    const count = await db.trade.count({
      where: {
        user_id: userId,
        close_time: {
          gte: startOfMonth
        }
      }
    })

    return count
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

    let trades = []

    if (userId) {
      trades = await db.trade.findMany({
        where: { user_id: userId },
        orderBy: { close_time: 'desc' },
        take: limit
      })
    } else {
      trades = await db.trade.findMany({
        orderBy: { close_time: 'desc' },
        take: limit
      })
    }

    return NextResponse.json({ trades })
  } catch (err) {
    console.error('Trades API error:', err)
    return NextResponse.json({ trades: [] })
  }
}

// POST - Create new trade
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trades POST] Starting trade creation...')
    
    // Get authenticated user
    const authUser = await getAuthUser(request)
    console.log('👤 [API] Auth user:', authUser ? { id: authUser.id, email: authUser.email } : 'null')
    
    if (!authUser) {
      console.log('❌ [API] Unauthorized - no auth user')
      return NextResponse.json({ error: 'Unauthorized - Please login' }, { status: 401 })
    }

    const userId = authUser.id
    const body = await request.json()
    console.log('📊 [API] Request body:', body)

    // Auto-create profile if not exists
    await ensureProfile(userId, authUser.email)
    console.log('✅ [API] Profile ensured for user:', userId)

    // SERVER-SIDE LIMIT CHECK: Free users can only have 15 trades per month
    const isPro = await isUserPro(userId)
    console.log('💎 [API] Is PRO user:', isPro)
    
    if (!isPro) {
      const tradeCount = await countUserTrades(userId)
      console.log('📈 [API] Trade count for user:', tradeCount, '/', FREE_TRADE_LIMIT)
      
      if (tradeCount >= FREE_TRADE_LIMIT) {
        console.log('⚠️ [API] Trade limit exceeded!')
        return NextResponse.json({
          error: `Pengguna Free dibatasi maksimal ${FREE_TRADE_LIMIT} jurnal transaksi per bulan. Upgrade ke PRO untuk akses UNLIMITED!`,
          code: 'TRADE_LIMIT_EXCEEDED',
          limit: FREE_TRADE_LIMIT,
          current: tradeCount,
          requiresUpgrade: true
        }, { status: 403 })
      }
    }

    console.log('💾 [API] Creating trade in database...')
    const trade = await db.trade.create({
      data: {
        user_id: userId,
        account_id: body.account_id || null,
        symbol: body.symbol.toUpperCase(),
        type: body.type, // BUY or SELL
        open_price: parseFloat(body.open_price),
        close_price: body.close_price ? parseFloat(body.close_price) : 0,
        lot_size: body.lot_size ? parseFloat(body.lot_size) : 0.01,
        profit_loss: body.profit_loss ? parseFloat(body.profit_loss) : 0,
        open_time: body.open_time ? new Date(body.open_time) : new Date(),
        close_time: body.close_time ? new Date(body.close_time) : (body.close_price ? new Date() : new Date()),
        session: body.session || null,
        notes: body.notes || null,
        image_url: body.image_url || null,
        screenshot_url: body.screenshot_url || null, // New field
        emotion: body.emotion || null, // New field
        setup_type: body.setup_type || null,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        risk_reward_ratio: body.risk_reward_ratio ? parseFloat(body.risk_reward_ratio) : null,
        trade_duration: body.trade_duration ? parseInt(body.trade_duration) : null,
        linked_journal_id: body.linked_journal_id || null,
        // Auto-set status to OPEN if no close_price or profit_loss
        status: (!body.close_price || !body.profit_loss) ? 'OPEN' : 'CLOSED',
      }
    })

    console.log('✅ [API] Trade created successfully:', trade.id)
    return NextResponse.json({ trade })
  } catch (err) {
    console.error('❌ [API] Trade create error:', err)
    return NextResponse.json({ error: 'Failed to create trade', details: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// PUT - Update trade
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    const trade = await db.trade.update({
      where: { id },
      data: updates
    })

    return NextResponse.json({ trade })
  } catch (err) {
    console.error('Trade update error:', err)
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

    await db.trade.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Trade delete error:', err)
    return NextResponse.json({ error: 'Failed to delete trade' }, { status: 500 })
  }
}
