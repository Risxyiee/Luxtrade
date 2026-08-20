import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { isUserPro } from '@/lib/pro-check'
import { checkAchievementsAfterTrade } from '@/lib/achievement-checker'
import { randomUUID } from 'crypto'

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

/** Auth helper: cookie + Bearer token fallback (same pattern as journal) */
function getClientWithAuth(request: NextRequest) {
  const { supabase: cookieClient } = createClientForApi(request)
  const authHeader = request.headers.get('Authorization')
  let bearerClient: ReturnType<typeof createClient> | null = null
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    bearerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    ;(bearerClient as any)._bearerToken = token
  }
  return { cookieClient, bearerClient }
}

async function getUserWithSession(request: NextRequest) {
  const { cookieClient, bearerClient } = getClientWithAuth(request)
  let { data: { user }, error } = await cookieClient.auth.getUser()
  if (user) return { user, client: cookieClient }
  if (bearerClient) {
    const token = (bearerClient as any)._bearerToken
    const result = await bearerClient.auth.getUser(token)
    if (result.data.user) return { user: result.data.user, client: bearerClient }
  }
  return { user: null, client: cookieClient }
}

// Helper: Count user trades for current month only (Supabase)
async function countUserTrades(client: any, userId: string): Promise<number> {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count, error } = await client
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('close_time', startOfMonth)
    return count || 0
  } catch (error) {
    console.warn('[countUserTrades] Failed to count trades:', error)
    return 0
  }
}

// GET - Fetch trades with cursor pagination
export async function GET(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)
    const cursor = searchParams.get('cursor') || null

    let query = client
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('close_time', { ascending: false })
      .limit(limit + 1) // fetch extra to detect next page

    if (cursor) {
      query = query.lt('close_time', cursor)
    }

    const { data, error } = await query

    if (error) {
      console.error('[trades GET] Supabase error:', error)
      return NextResponse.json({ trades: [], pagination: { hasNextPage: false, nextCursor: null, limit } })
    }

    const trades = data || []
    const hasNextPage = trades.length > limit
    const resultTrades = hasNextPage ? trades.slice(0, limit) : trades
    const nextCursor = hasNextPage && resultTrades.length > 0
      ? resultTrades[resultTrades.length - 1].close_time
      : null

    return NextResponse.json({
      trades: resultTrades,
      pagination: { hasNextPage, nextCursor, limit },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch trades', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new trade
export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const { user, client } = await getUserWithSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const userId = user.id
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

    // Check PRO status BEFORE creating trade
    const pro = await isUserPro(userId)

    if (!pro) {
      const tradeCount = await countUserTrades(client, userId)
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

    // Create trade via Supabase
    const tradeData = {
      id: randomUUID(),
      user_id: userId,
      account_id: body.account_id ? String(body.account_id) : null,
      symbol: String(body.symbol).toUpperCase(),
      type: String(body.type),
      open_price: parseFloat(String(body.open_price)),
      close_price: parseFloat(String(body.close_price)),
      lot_size: parseFloat(String(body.lot_size)),
      profit_loss: parseFloat(String(body.profit_loss)),
      open_time: body.open_time ? new Date(String(body.open_time)).toISOString() : new Date().toISOString(),
      close_time: body.close_time ? new Date(String(body.close_time)).toISOString() : new Date().toISOString(),
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: trade, error: insertError } = await client
      .from('trades')
      .insert([tradeData])
      .select()
      .single()

    if (insertError) {
      console.error('[trades POST] Insert error:', insertError)
      if (insertError.code === '23503') {
        return NextResponse.json(
          { error: 'Profile not found. Please refresh and try again.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create trade', details: insertError.message },
        { status: 500 }
      )
    }

    // Check achievements (non-critical, uses Prisma internally — only on POST, not GET)
    let unlockedAchievements: any[] = []
    try {
      unlockedAchievements = await checkAchievementsAfterTrade(userId)
    } catch (achErr) {
      console.warn('[trades POST] Achievement check failed (non-critical):', achErr)
    }

    return NextResponse.json({ success: true, trade, unlockedAchievements })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create trade', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update trade
export async function PUT(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)
    if (!user) {
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
    const { data: existingTrade, error: findError } = await client
      .from('trades')
      .select('id, user_id')
      .eq('id', String(id))
      .single()

    if (findError || !existingTrade) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      )
    }

    if (existingTrade.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Trade belongs to another user' },
        { status: 403 }
      )
    }

    // Convert numeric fields
    const updateData: any = { updated_at: new Date().toISOString() }
    if (updates.open_price !== undefined) updateData.open_price = parseFloat(String(updates.open_price))
    if (updates.close_price !== undefined) updateData.close_price = parseFloat(String(updates.close_price))
    if (updates.lot_size !== undefined) updateData.lot_size = parseFloat(String(updates.lot_size))
    if (updates.profit_loss !== undefined) updateData.profit_loss = parseFloat(String(updates.profit_loss))
    if (updates.stop_loss !== undefined) updateData.stop_loss = parseFloat(String(updates.stop_loss))
    if (updates.take_profit !== undefined) updateData.take_profit = parseFloat(String(updates.take_profit))
    if (updates.risk_reward_ratio !== undefined) updateData.risk_reward_ratio = parseFloat(String(updates.risk_reward_ratio))
    if (updates.trade_duration !== undefined) updateData.trade_duration = parseInt(String(updates.trade_duration))
    if (updates.open_time !== undefined) updateData.open_time = new Date(String(updates.open_time)).toISOString()
    if (updates.close_time !== undefined) updateData.close_time = new Date(String(updates.close_time)).toISOString()
    // Copy string fields as-is
    if (updates.symbol !== undefined) updateData.symbol = String(updates.symbol).toUpperCase()
    if (updates.type !== undefined) updateData.type = String(updates.type)
    if (updates.session !== undefined) updateData.session = updates.session ? String(updates.session) : null
    if (updates.notes !== undefined) updateData.notes = updates.notes ? String(updates.notes) : null
    if (updates.emotion !== undefined) updateData.emotion = updates.emotion ? String(updates.emotion) : null
    if (updates.setup_type !== undefined) updateData.setup_type = updates.setup_type ? String(updates.setup_type) : null
    if (updates.tags !== undefined) updateData.tags = updates.tags ? JSON.stringify(updates.tags) : null
    if (updates.account_id !== undefined) updateData.account_id = updates.account_id ? String(updates.account_id) : null
    if (updates.ticket_number !== undefined) updateData.ticket_number = updates.ticket_number ? String(updates.ticket_number) : null
    if (updates.image_url !== undefined) updateData.image_url = updates.image_url ? String(updates.image_url) : null
    if (updates.screenshot_url !== undefined) updateData.screenshot_url = updates.screenshot_url ? String(updates.screenshot_url) : null
    if (updates.linked_journal_id !== undefined) updateData.linked_journal_id = updates.linked_journal_id ? String(updates.linked_journal_id) : null

    const { data: trade, error: updateError } = await client
      .from('trades')
      .update(updateData)
      .eq('id', String(id))
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update trade', details: updateError.message },
        { status: 500 }
      )
    }

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
    const { user, client } = await getUserWithSession(request)
    if (!user) {
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

    // Verify ownership + delete in one query (RLS also enforces this)
    const { error } = await client
      .from('trades')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete trade' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete trade', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
