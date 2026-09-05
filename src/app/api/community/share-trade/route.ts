import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { edgeCrypto } from '@/lib/edge-crypto'

function generateShareCode(): string {
  return edgeCrypto.randomBytesHex(6).toUpperCase()
}

// POST: Generate a shareable trade card
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  const response = authResult.response
  const user = authResult.user
  if (response) return response

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { tradeId, includeAnalytics = true } = body

    if (!tradeId) {
      return NextResponse.json({ error: 'tradeId is required' }, { status: 400 })
    }

    // Verify the trade belongs to the user
    const { data: trade } = await admin.from('trades')
      .select('id')
      .eq('id', tradeId)
      .eq('user_id', user!.id)
      .maybeSingle()

    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    // Check if already shared
    const { data: existing } = await admin.from('community_trades')
      .select('id, share_code')
      .eq('trade_id', tradeId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        shareCode: existing.share_code,
        message: 'Trade already shared',
      })
    }

    // Generate unique share code
    let shareCode = generateShareCode()
    let attempts = 0
    while (attempts < 5) {
      const { data: collision } = await admin.from('community_trades')
        .select('id')
        .eq('share_code', shareCode)
        .maybeSingle()
      if (!collision) break
      shareCode = generateShareCode()
      attempts++
    }

    await admin.from('community_trades').insert({
      trade_id: tradeId,
      user_id: user!.id,
      share_code: shareCode,
      include_analytics: includeAnalytics,
    })

    return NextResponse.json({ shareCode })
  } catch (err: any) {
    console.error('[Share Trade API] Error:', err)
    return NextResponse.json({ error: 'Failed to share trade' }, { status: 500 })
  }
}

// GET: Retrieve a shared trade by shareCode (no auth required for viewing)
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const shareCode = searchParams.get('code')

    if (!shareCode) {
      return NextResponse.json({ error: 'share code is required' }, { status: 400 })
    }

    const { data: shared } = await admin.from('community_trades')
      .select('trade_id, share_code, include_analytics, created_at, user_id')
      .eq('share_code', shareCode)
      .maybeSingle()

    if (!shared) {
      return NextResponse.json({ error: 'Shared trade not found' }, { status: 404 })
    }

    // Fetch trade data (only public-safe fields)
    const { data: tradeRows } = await admin.from('trades')
      .select('id, symbol, type, profit_loss, open_price, close_price, session, setup_type, close_time, lot_size')
      .eq('id', shared.trade_id)
      .maybeSingle()

    if (!tradeRows) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    const trade = tradeRows

    // Calculate P/L percentage from prices
    const plPercent = trade.open_price !== 0
      ? Math.round(((trade.close_price - trade.open_price) / trade.open_price) * 10000) / 100
      : 0

    // Fetch owner's public stats
    const { data: profile } = await admin.from('profiles')
      .select('full_name, is_pro, streak_count, best_streak')
      .eq('id', shared.user_id)
      .maybeSingle()

    // Fetch owner's aggregate stats if analytics included
    let ownerStats: { totalTrades: number; winRate: number; totalPL: number } | null = null
    if (shared.include_analytics && profile) {
      const { data: trades } = await admin.from('trades')
        .select('id, profit_loss')
        .eq('user_id', shared.user_id)

      if (trades && trades.length > 0) {
        const totalTrades = trades.length
        const wins = trades.filter((t: any) => Number(t.profit_loss) > 0).length
        const totalPL = trades.reduce((sum: number, t: any) => sum + Number(t.profit_loss || 0), 0)
        ownerStats = {
          totalTrades,
          winRate: totalTrades > 0
            ? Math.round((wins / totalTrades) * 1000) / 100
            : 0,
          totalPL: Math.round(totalPL * 100) / 100,
        }
      }
    }

    return NextResponse.json({
      trade: {
        symbol: trade.symbol,
        type: trade.type,
        plPercent,
        plAmount: Math.round(Number(trade.profit_loss) * 100) / 100,
        session: trade.session,
        setupType: trade.setup_type,
        closeTime: trade.close_time,
      },
      owner: profile ? {
        displayName: profile.full_name,
        isPro: profile.is_pro,
        streak: profile.streak_count,
        bestStreak: profile.best_streak,
      } : null,
      ownerStats,
    })
  } catch (err: any) {
    console.error('[Share Trade GET API] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch shared trade' }, { status: 500 })
  }
}
