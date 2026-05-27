import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'
import { checkAchievementsAfterTrade } from '@/lib/achievement-checker'

// Free user trade limit - 10 trades per month
const FREE_TRADE_LIMIT = 10

// Helper: Get authenticated user from request
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('❌ [API] Supabase auth error:', error.message)
      return null
    }

    if (!user) {
      console.log('❌ [API] No user found in session')
      return null
    }

    console.log('✅ [API] Authenticated user:', { id: user.id, email: user.email })
    return { id: user.id, email: user.email || '' }
  } catch (error) {
    console.error('❌ [API] Auth error:', error)
    return null
  }
}

// Helper: Ensure profile exists (auto-create if not) - MUST RUN FIRST
async function ensureProfile(userId: string, email?: string): Promise<void> {
  try {
    const existing = await db.profile.findUnique({
      where: { id: userId }
    })

    if (!existing) {
      console.log('📝 [API] Auto-creating profile for user:', userId)
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
      console.log('✅ [API] Profile created successfully')
    } else {
      // Update email if changed
      if (email && existing.email !== email) {
        await db.profile.update({
          where: { id: userId },
          data: { email, updatedAt: new Date() }
        })
        console.log('✅ [API] Profile email updated')
      }
    }
  } catch (error) {
    console.error('❌ [API] Error creating profile:', error)
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
  } catch (error) {
    console.error('❌ [API] Error checking PRO status:', error)
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
  } catch (error) {
    console.error('❌ [API] Error counting trades:', error)
    return 0
  }
}

// GET - Fetch all trades
export async function GET(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trades GET] Fetching trades...')

    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
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

    console.log(`✅ [API] Found ${trades.length} trades for user ${authUser.id}`)
    return NextResponse.json({ trades })
  } catch (err) {
    console.error('❌ [API /api/trades GET] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch trades', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new trade
export async function POST(request: NextRequest) {
  let createdTradeId: string | null = null
  
  try {
    console.log('🟢 [API /api/trades POST] Starting trade creation...')

    // Get authenticated user
    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const userId = authUser.id
    const body = await request.json()
    console.log('📊 [API] Request body:', body)
    console.log('👤 [API] User ID:', userId)
    console.log('📧 [API] User Email:', authUser.email)

    // Validate required fields
    const requiredFields = ['symbol', 'type', 'open_price', 'lot_size', 'profit_loss', 'open_time', 'close_time']
    const missingFields = requiredFields.filter(field => !body[field] && body[field] !== 0)

    if (missingFields.length > 0) {
      console.log('❌ [API] Missing required fields:', missingFields)
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // STEP 1: Auto-create profile if not exists - CRITICAL FOR DATA INTEGRITY
    await ensureProfile(userId, authUser.email)
    console.log('✅ [API] Profile ensured for user:', userId)

    // STEP 2: Check PRO status BEFORE creating trade
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
        risk_reward_ratio: body.risk_reward_ratio ? parseFloat(String(body.risk_reward_ratio)) : null,
        trade_duration: body.trade_duration ? parseInt(String(body.trade_duration)) : null,
        linked_journal_id: body.linked_journal_id ? String(body.linked_journal_id) : null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    })

    createdTradeId = trade.id
    console.log('✅ [API] Trade created successfully:', {
      id: trade.id,
      symbol: trade.symbol,
      user_id: trade.user_id
    })

    // STEP 4: Verify trade ownership immediately
    const verification = await db.trade.findUnique({
      where: { id: trade.id },
      select: { id: true, user_id: true, symbol: true }
    })
    
    if (!verification || verification.user_id !== userId) {
      console.error('❌ [API] CRITICAL: Trade ownership verification failed!', {
        tradeId: trade.id,
        expectedUserId: userId,
        actualUserId: verification?.user_id
      })
      // Trade was created but with wrong user_id - this is a critical data integrity issue
    } else {
      console.log('✅ [API] Trade ownership verified:', verification)
    }

    // STEP 5: Check achievements after trade creation
    console.log('🏆 [API] Checking achievements after trade...')
    let unlockedAchievements: any[] = []
    try {
      unlockedAchievements = await checkAchievementsAfterTrade(userId)
      if (unlockedAchievements.length > 0) {
        console.log(`🎉 [API] Unlocked ${unlockedAchievements.length} achievements:`, unlockedAchievements)
      }
    } catch (error) {
      console.error('❌ [API] Error checking achievements:', error)
      // Don't fail the trade creation if achievement check fails
    }

    return NextResponse.json({
      success: true,
      trade,
      unlockedAchievements,
      debug: {
        userId,
        tradeId: trade.id,
        verified: verification?.user_id === userId
      }
    })
  } catch (err) {
    console.error('❌ [API /api/trades POST] Error:', err)
    console.error('❌ [API] Trade ID (if created):', createdTradeId)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')

    // Check for specific Prisma errors
    if (err instanceof Error) {
      if (err.message.includes('Foreign key constraint')) {
        console.error('❌ [API] Foreign key constraint violation - PROFILE MAY NOT EXIST')
        return NextResponse.json(
          { error: 'Profile not found. Please refresh and try again.', details: err.message },
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
    console.log('🟢 [API /api/trades PUT] Updating trade...')

    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      console.log('❌ [API] Missing trade ID')
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
      console.log('❌ [API] Trade not found')
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      )
    }

    if (existingTrade.user_id !== authUser.id) {
      console.log('❌ [API] Unauthorized - trade belongs to another user')
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
    if (updates.risk_reward_ratio !== undefined) updateData.risk_reward_ratio = parseFloat(String(updates.risk_reward_ratio))
    if (updates.trade_duration !== undefined) updateData.trade_duration = parseInt(String(updates.trade_duration))
    if (updates.open_time !== undefined) updateData.open_time = new Date(String(updates.open_time))
    if (updates.close_time !== undefined) updateData.close_time = new Date(String(updates.close_time))

    const trade = await db.trade.update({
      where: { id: String(id) },
      data: updateData
    })

    console.log('✅ [API] Trade updated successfully:', trade.id)
    return NextResponse.json({ trade })
  } catch (err) {
    console.error('❌ [API /api/trades PUT] Error:', err)
    return NextResponse.json(
      { error: 'Failed to update trade', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete trade
export async function DELETE(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trades DELETE] Deleting trade...')

    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      console.log('❌ [API] Missing trade ID')
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
      console.log('❌ [API] Trade not found')
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      )
    }

    if (existingTrade.user_id !== authUser.id) {
      console.log('❌ [API] Unauthorized - trade belongs to another user')
      return NextResponse.json(
        { error: 'Unauthorized - Trade belongs to another user' },
        { status: 403 }
      )
    }

    await db.trade.delete({
      where: { id: String(id) }
    })

    console.log('✅ [API] Trade deleted successfully')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('❌ [API /api/trades DELETE] Error:', err)
    return NextResponse.json(
      { error: 'Failed to delete trade', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
