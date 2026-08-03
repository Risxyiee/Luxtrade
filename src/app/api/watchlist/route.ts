import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db, ensureSchema } from '@/lib/db'
import { isUserPro } from '@/lib/pro-check'

// GET - Fetch watchlist
export async function GET(request: NextRequest) {
  try {
    await ensureSchema()

    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await db.watchlistItem.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: 'desc' },
      take: 200, // reasonable cap
    })

    return NextResponse.json({
      items: items.map(item => ({
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        target_price: item.targetPrice,
        notes: item.notes,
        created_at: item.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('[watchlist GET] Error:', error)
    return NextResponse.json({ items: [] })
  }
}

// POST - Add to watchlist
export async function POST(request: NextRequest) {
  try {
    await ensureSchema()

    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pro = await isUserPro(authUser.id)
    if (!pro) {
      return NextResponse.json({ error: 'PRO_REQUIRED', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.symbol || !body.symbol.trim()) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    // Ensure profile exists
    try {
      const existing = await db.profile.findUnique({ where: { id: authUser.id } })
      if (!existing) {
        await db.profile.create({
          data: {
            id: authUser.id,
            email: authUser.email,
            plan: 'FREE',
            is_pro: false,
            role: 'USER',
            streakCount: 0,
            bestStreak: 0,
            achievements: [],
          }
        })
      }
    } catch (ensureErr) {
      console.warn('[watchlist POST] ensureProfile failed (may already exist):', ensureErr)
    }

    const item = await db.watchlistItem.create({
      data: {
        userId: authUser.id,
        symbol: body.symbol.toUpperCase(),
        name: body.name || body.symbol.toUpperCase(),
        targetPrice: body.target_price ? parseFloat(body.target_price) : null,
        notes: body.notes || null,
      }
    })

    return NextResponse.json({
      item: {
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        target_price: item.targetPrice,
        notes: item.notes,
        created_at: item.createdAt.toISOString()
      }
    })
  } catch (error: any) {
    console.error('[watchlist POST] Error:', error)
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })
  }
}

// DELETE - Remove from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    // Verify ownership
    const item = await db.watchlistItem.findUnique({ where: { id } })
    if (!item || item.userId !== authUser.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await db.watchlistItem.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[watchlist DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 })
  }
}