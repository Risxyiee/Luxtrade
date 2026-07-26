import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { isUserPro } from '@/lib/pro-check'
import { checkAchievementsAfterTrade } from '@/lib/achievement-checker'

// Free user trade limit - 10 trades per month
const FREE_TRADE_LIMIT = 10

// In-memory rate limiter for POST
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 15 // 15 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  let entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
    rateLimitMap.set(ip, entry)
  }
  entry.count++
  return entry.count <= RATE_LIMIT_MAX
}

// Helper: Check if user is PRO (imported from shared utility)
// Use imported isUserPro from '@/lib/pro-check'

// Helper: Ensure profile exists (auto-create if not) - MUST RUN FIRST
async function ensureProfile(userId: string, email?: string): Promise<void> {
  try {
    const existing = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!existing) {
      await db.profile.create({
        data: {
          id: userId,
          email: email || null,
          plan: 'FREE',
          is_pro: false,
          role: 'USER',
          streakCount: 0,
          bestStreak: 0,
          achievements: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    } else {
      // Update email if changed
      if (email && existing.email !== email) {
        await db.profile.update({
          where: { id: userId },
          data: { email, updatedAt: new Date() }
        })
      }
    }
  } catch (error) {
    throw error
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
  } catch (error) {
    console.warn('[countUserTrades] Failed to count trades:', error)
    return 0
  }
}

// GET - Fetch all trades
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')

    const trades = await db.trade.findMany({
      where: { user_id: authUser.id },
      orderBy: { close_time: 'desc' },
      take: limit
    })

    return NextResponse.json({ trades })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch trades', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new trade
export async function POST(request: NextRequest) {
  // Rate limit check
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  let createdTradeId: string | null = null
  
  try {
    // Get authenticated user
    const authUser = await getAuthUser(request)

    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const userId = authUser.id
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['symbol', 'type', 'open_price', 'lot_size', 'profit_loss', 'open_time', 'close_time']
    const missingFields = requiredFields.filter(field => !body[field] && body[field] !== 0)

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // STEP 1: Auto-create profile if not exists - CRITICAL FOR DATA INTEGRITY
    await ensureProfile(userId, authUser.email)

    // STEP 2: Check PRO status BEFORE creating trade
    const pro = await isUserPro(userId)

    if (!pro) {
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

    // STEP 3: Create trade with explicit user_id
    const trade = await db.trade.create({
      data: {
        user_id: userId, // EXPLICIT USER ID - PREVENTS DATA LOSS
        account_id: body.account_id ? String(body.account_id) : null,
        symbol: String(body.symbol).toUpperCase(),
        type: String(body.type),
        open_price: parseFloat(String(body.open_price)),
        close_price: parseFloat(String(body.close_price)),
        lot_size: parseFloat(String(body.lot_size)),
        profit_loss: parseFloat(String(body.profit_loss)),
        open_time: body.open_time ? new Date(String(body.open_time)) : new Date(),
        close_time: body.close_time ? new Date(String(body.close_time)) : new Date(),
        session: body.session ? String(body.session) : null,
        notes: body.notes ? String(body.notes) : null,
        image_url: body.image_url ? String(body.image_url) : null,
        screenshot_url: body.screenshot_url ? String(body.screenshot_url) : null,
        emotion: body.emotion ? String(body.emotion) : null,
        setup_type: body.setup_type ? String(body.setup_type) : null,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        stop_loss: body.stop_loss != null && body.stop_loss !== '' ? parseFloat(String(body.stop_loss)) : null,
        take_profit: body.take_profit != null && body.take_profit !== '' ? parseFloat(String(body.take_profit)) : null,
        ticket_number: body.ticket_number ? String(body.ticket_number) : null,
        risk_reward_ratio: body.risk_reward_ratio ? parseFloat(String(body.risk_reward_ratio)) : null,
        trade_duration: body.trade_duration ? parseInt(String(body.trade_duration)) : null,
        linked_journal_id: body.linked_journal_id ? String(body.linked_journal_id) : null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    })

    createdTradeId = trade.id

    // STEP 4: Verify trade ownership immediately
    const verification = await db.trade.findUnique({
      where: { id: trade.id },
      select: { id: true, user_id: true, symbol: true }
    })
    
    if (!verification || verification.user_id !== userId) {
      // Trade was created but with wrong user_id - this is a critical data integrity issue
      if (process.env.NODE_ENV === 'development') {
        console.error('CRITICAL: Trade ownership verification failed!')
      }
    }

    // STEP 5: Check achievements after trade creation
    let unlockedAchievements: any[] = []
    try {
      unlockedAchievements = await checkAchievementsAfterTrade(userId)
    } catch (achErr) {
      console.warn('[trades POST] Achievement check failed (non-critical):', achErr)
    }

    return NextResponse.json({
      success: true,
      trade,
      unlockedAchievements,
    })
  } catch (err) {
    // Check for specific Prisma errors
    if (err instanceof Error) {
      if (err.message.includes('Foreign key constraint')) {
        return NextResponse.json(
          { error: 'Profile not found. Please refresh and try again.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to create trade', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update trade
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Trade ID is required' },
        { status: 400 }
      )
    }

    // Verify trade belongs to user
    const existingTrade = await db.trade.findUnique({
      where: { id: String(id) }
    })

    if (!existingTrade) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      )
    }

    if (existingTrade.user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Trade belongs to another user' },
        { status: 403 }
      )
    }

    // Convert numeric fields
    const updateData: any = {
      ...updates,
      updated_at: new Date(),
    }

    if (updates.open_price !== undefined) updateData.open_price = parseFloat(String(updates.open_price))
    if (updates.close_price !== undefined) updateData.close_price = parseFloat(String(updates.close_price))
    if (updates.lot_size !== undefined) updateData.lot_size = parseFloat(String(updates.lot_size))
    if (updates.profit_loss !== undefined) updateData.profit_loss = parseFloat(String(updates.profit_loss))
    if (updates.stop_loss !== undefined) updateData.stop_loss = parseFloat(String(updates.stop_loss))
    if (updates.take_profit !== undefined) updateData.take_profit = parseFloat(String(updates.take_profit))
    if (updates.risk_reward_ratio !== undefined) updateData.risk_reward_ratio = parseFloat(String(updates.risk_reward_ratio))
    if (updates.trade_duration !== undefined) updateData.trade_duration = parseInt(String(updates.trade_duration))
    if (updates.open_time !== undefined) updateData.open_time = new Date(String(updates.open_time))
    if (updates.close_time !== undefined) updateData.close_time = new Date(String(updates.close_time))

    const trade = await db.trade.update({
      where: { id: String(id) },
      data: updateData
    })

    return NextResponse.json({ trade })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update trade', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete trade
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Trade ID is required' },
        { status: 400 }
      )
    }

    // Verify trade belongs to user
    const existingTrade = await db.trade.findUnique({
      where: { id: String(id) }
    })

    if (!existingTrade) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      )
    }

    if (existingTrade.user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Trade belongs to another user' },
        { status: 403 }
      )
    }

    await db.trade.delete({
      where: { id: String(id) }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete trade', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}