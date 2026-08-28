import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { isDatabaseAvailable } from '@/lib/db'
import crypto from 'crypto'

async function ensureSharedTradesTable() {
  try {
    // Fix existing table if it was created with wrong UUID type for trade_id
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Check if table exists with wrong trade_id type (uuid instead of text)
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'shared_trades' AND column_name = 'trade_id' AND data_type = 'uuid'
        ) THEN
          -- Drop and recreate with correct types
          DROP TABLE IF EXISTS shared_trades CASCADE;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'shared_trades'
        ) THEN
          CREATE TABLE shared_trades (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            trade_id TEXT NOT NULL UNIQUE REFERENCES trades(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            share_code TEXT NOT NULL UNIQUE,
            include_analytics BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT now()
          );
          CREATE INDEX idx_shared_trades_user_id ON shared_trades(user_id);
          CREATE INDEX idx_shared_trades_share_code ON shared_trades(share_code);
        END IF;
      END $$;
    `)
  } catch {
    // Table may already exist
  }
}

function generateShareCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase()
}

// POST: Generate a shareable trade card
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { tradeId, includeAnalytics = true } = body

    if (!tradeId) {
      return NextResponse.json({ error: 'tradeId is required' }, { status: 400 })
    }

    await ensureSharedTradesTable()

    // Verify the trade belongs to the user
    const trade = await db.trade.findFirst({
      where: { id: tradeId, user_id: user.id },
    })

    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    // Check if already shared
    const existing = await db.$queryRawUnsafe<{ id: string; share_code: string }[]>(
      `SELECT id, share_code FROM shared_trades WHERE trade_id = $1`,
      tradeId
    )

    if (existing.length > 0) {
      return NextResponse.json({
        shareCode: existing[0].share_code,
        message: 'Trade already shared',
      })
    }

    // Generate unique share code
    let shareCode = generateShareCode()
    let attempts = 0
    while (attempts < 5) {
      const collision = await db.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM shared_trades WHERE share_code = $1`,
        shareCode
      )
      if (collision.length === 0) break
      shareCode = generateShareCode()
      attempts++
    }

    await db.$executeRawUnsafe(
      `INSERT INTO shared_trades (trade_id, user_id, share_code, include_analytics, created_at) VALUES ($1, $2, $3, $4, now())`,
      tradeId,
      user.id,
      shareCode,
      includeAnalytics
    )

    return NextResponse.json({ shareCode })
  } catch (err: any) {
    console.error('[Share Trade API] Error:', err)
    return NextResponse.json({ error: 'Failed to share trade' }, { status: 500 })
  }
}

// GET: Retrieve a shared trade by shareCode (no auth required for viewing)
export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const shareCode = searchParams.get('code')

    if (!shareCode) {
      return NextResponse.json({ error: 'share code is required' }, { status: 400 })
    }

    await ensureSharedTradesTable()

    const rows = await db.$queryRawUnsafe<{
      trade_id: string
      share_code: string
      include_analytics: boolean
      created_at: string
      user_id: string
    }[]>(
      `SELECT trade_id, share_code, include_analytics, created_at, user_id FROM shared_trades WHERE share_code = $1`,
      shareCode
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Shared trade not found' }, { status: 404 })
    }

    const shared = rows[0]

    // Fetch trade data (only public-safe fields)
    const trades = await db.$queryRawUnsafe<{
      id: string
      symbol: string
      type: string
      profit_loss: number
      open_price: number
      close_price: number
      session: string | null
      setup_type: string | null
      close_time: string
      lot_size: number
    }[]>(
      `SELECT 
        id, symbol, type, profit_loss, open_price, close_price, 
        session, setup_type, close_time, lot_size 
       FROM trades WHERE id = $1`,
      shared.trade_id
    )

    if (trades.length === 0) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    const trade = trades[0]

    // Calculate P/L percentage from prices
    const plPercent = trade.open_price !== 0
      ? Math.round(((trade.close_price - trade.open_price) / trade.open_price) * 10000) / 100
      : 0

    // Fetch owner's public stats
    const profiles = await db.$queryRawUnsafe<{
      full_name: string | null
      is_pro: boolean
      streak_count: number
      best_streak: number
    }[]>(
      `SELECT full_name, is_pro, streak_count, best_streak FROM profiles WHERE id = $1`,
      shared.user_id
    )

    const profile = profiles[0] || null

    // Fetch owner's aggregate stats if analytics included
    let ownerStats: { totalTrades: number; winRate: number; totalPL: number } | null = null
    if (shared.include_analytics && profile) {
      const stats = await db.$queryRawUnsafe<{
        total_trades: bigint
        wins: bigint
        total_pl: number
      }[]>(
        `SELECT 
          COUNT(id) as total_trades,
          COUNT(CASE WHEN profit_loss > 0 THEN 1 END) as wins,
          COALESCE(SUM(profit_loss), 0) as total_pl
         FROM trades WHERE user_id = $1`,
        shared.user_id
      )
      if (stats.length > 0) {
        const s = stats[0]
        ownerStats = {
          totalTrades: Number(s.total_trades),
          winRate: Number(s.total_trades) > 0
            ? Math.round((Number(s.wins) / Number(s.total_trades)) * 1000) / 100
            : 0,
          totalPL: Math.round(s.total_pl * 100) / 100,
        }
      }
    }

    return NextResponse.json({
      trade: {
        symbol: trade.symbol,
        type: trade.type,
        plPercent,
        plAmount: Math.round(trade.profit_loss * 100) / 100,
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
