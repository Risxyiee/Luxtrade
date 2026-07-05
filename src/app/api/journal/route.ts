import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { isUserPro, countUserJournalsThisMonth, FREE_JOURNAL_LIMIT } from '@/lib/pro-check'
import { createClient } from '@supabase/supabase-js'

/** Get a Supabase client with user session (cookie or Bearer token) */
function getClientWithAuth(request: NextRequest) {
  // Try cookie-based first
  const { supabase: cookieClient } = createClientForApi(request)
  // Also create a Bearer-based client as fallback
  const authHeader = request.headers.get('Authorization')
  let bearerClient: ReturnType<typeof createClient> | null = null
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    bearerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    // Store token for later use
    ;(bearerClient as any)._bearerToken = token
  }
  return { cookieClient, bearerClient }
}

async function getUserWithSession(request: NextRequest) {
  const { cookieClient, bearerClient } = getClientWithAuth(request)

  // Try cookie-based
  let { data: { user }, error } = await cookieClient.auth.getUser()
  if (user) return { user, client: cookieClient }

  // Try Bearer token
  if (bearerClient) {
    const token = (bearerClient as any)._bearerToken
    const result = await bearerClient.auth.getUser(token)
    if (result.data.user) return { user: result.data.user, client: bearerClient }
  }

  return { user: null, client: cookieClient }
}

// In-memory rate limiter for POST
const journalRateLimitMap = new Map<string, { count: number; resetAt: number }>()
const JOURNAL_RATE_LIMIT_WINDOW_MS = 60_000
const JOURNAL_RATE_LIMIT_MAX = 10

function checkJournalRateLimit(userId: string): boolean {
  const now = Date.now()
  let entry = journalRateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + JOURNAL_RATE_LIMIT_WINDOW_MS }
    journalRateLimitMap.set(userId, entry)
  }
  entry.count++
  return entry.count <= JOURNAL_RATE_LIMIT_MAX
}

// GET - Fetch journal entries with optional analytics
export async function GET(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const includeAnalytics = searchParams.get('analytics') === 'true'

    const { data, error } = await client
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      // Table doesn't exist or RLS issue — return empty instead of 500
      return NextResponse.json({ entries: [] })
    }

    const entries = data || []

    let analytics: Record<string, any> | null = null
    if (includeAnalytics && entries.length > 0) {
      analytics = calculateJournalAnalytics(entries)
    }

    return NextResponse.json({ entries, analytics })
  } catch {
    return NextResponse.json({ entries: [] })
  }
}

// POST - Create journal entry
export async function POST(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit
    if (!checkJournalRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

    // Pro check
    const pro = await isUserPro(user.id)
    if (!pro) {
      const monthCount = await countUserJournalsThisMonth(user.id)
      if (monthCount >= FREE_JOURNAL_LIMIT) {
        return NextResponse.json({ error: 'JOURNAL_LIMIT_EXCEEDED', code: 'JOURNAL_LIMIT_EXCEEDED', remaining: 0 }, { status: 403 })
      }
    }

    const body = await request.json()

    // Create journal entry
    const { data: journalData, error: journalError } = await client
      .from('journal_entries')
      .insert([{
        user_id: user.id,
        title: body.title,
        content: body.content,
        mood: body.mood || null,
        market_condition: body.market_condition || null,
        tags: body.tags || null,
        image_url: body.image_url || null,
      }])
      .select()
      .single()

    if (journalError) {
      console.error('Journal error:', journalError)
      return NextResponse.json({ error: journalError.message }, { status: 500 })
    }

    // If trade data is provided and saveTrade is true, create trade entry
    if (body.saveTrade && body.tradeData) {
      const { tradeData } = body

      const { error: tradeError } = await client
        .from('trades')
        .insert([{
          user_id: user.id,
          account_id: body.account_id || null,
          symbol: tradeData.symbol,
          type: tradeData.type,
          open_price: tradeData.open_price,
          close_price: tradeData.close_price,
          lot_size: tradeData.lot_size,
          profit_loss: tradeData.profit_loss,
          open_time: tradeData.open_time,
          close_time: tradeData.close_time,
          session: tradeData.session || null,
          notes: tradeData.notes || null,
          image_url: tradeData.image_url || tradeData.screenshot_url || null,
          screenshot_url: tradeData.screenshot_url || null,
          linked_journal_id: journalData.id, // Link trade to journal
        }])

      if (tradeError) {
        console.error('Trade creation error:', tradeError)
        // Don't fail the journal creation if trade fails, just log it
      } else {
        console.log('✅ Trade created and linked to journal:', journalData.id)
      }
    }

    return NextResponse.json({ entry: journalData })
  } catch (error: any) {
    console.error('Journal creation error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create journal entry' }, { status: 500 })
  }
}

// DELETE - Delete journal entry
export async function DELETE(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    const { error } = await client
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 })
  }
}

// ==================== JOURNAL ANALYTICS ENGINE ====================

function calculateJournalAnalytics(entries: any[]) {
  // Calculate streak
  const streak = calculateStreak(entries)

  // Calculate mood distribution
  const moodDistribution = { confident: 0, neutral: 0, anxious: 0, none: 0 }
  entries.forEach(e => {
    if (e.mood === 'confident') moodDistribution.confident++
    else if (e.mood === 'neutral') moodDistribution.neutral++
    else if (e.mood === 'anxious') moodDistribution.anxious++
    else moodDistribution.none++
  })

  // Calculate mood trend (last 7 entries)
  const moodTrend = entries.slice(0, 7).reverse().map(e => ({
    date: new Date(e.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    mood: e.mood || 'none',
    moodScore: e.mood === 'confident' ? 3 : e.mood === 'neutral' ? 2 : e.mood === 'anxious' ? 1 : 0
  }))

  // Market condition distribution
  const marketDistribution: Record<string, number> = {}
  entries.forEach(e => {
    const mc = e.market_condition || 'unspecified'
    marketDistribution[mc] = (marketDistribution[mc] || 0) + 1
  })

  // Weekly activity (entries per week in last 4 weeks)
  const now = new Date()
  const weeklyActivity = []
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (w * 7 + now.getDay()))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const count = entries.filter(e => {
      const d = new Date(e.created_at)
      return d >= weekStart && d < weekEnd
    }).length

    weeklyActivity.push({
      week: `Week -${w}`,
      count,
      start: weekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    })
  }

  // Average words per entry
  const avgWords = entries.length > 0
    ? Math.round(entries.reduce((sum: number, e: any) => sum + (e.content || '').split(/\s+/).length, 0) / entries.length)
    : 0

  // Generate weekly summary
  const weeklySummary = generateWeeklySummary(entries, moodDistribution, streak)

  return {
    totalEntries: entries.length,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    moodDistribution,
    moodTrend,
    marketDistribution,
    weeklyActivity,
    avgWordsPerEntry: avgWords,
    weeklySummary,
    totalWords: entries.reduce((sum: number, e: any) => sum + (e.content || '').split(/\s+/).length, 0),
    daysActive: new Set(entries.map((e: any) => new Date(e.created_at).toDateString())).size,
  }
}

function calculateStreak(entries: any[]) {
  if (entries.length === 0) return { current: 0, longest: 0 }

  // Get unique dates (sorted most recent first)
  const dates = [...new Set(entries.map(e => new Date(e.created_at).toDateString()))]
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  let currentStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if the most recent entry is today or yesterday
  const firstDate = dates[0]
  firstDate.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays > 1) {
    currentStreak = 0 // Streak broken
  } else {
    currentStreak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = dates[i - 1]
      const curr = dates[i]
      prev.setHours(0, 0, 0, 0)
      curr.setHours(0, 0, 0, 0)
      const gap = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))
      if (gap === 1) {
        currentStreak++
      } else {
        break
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0
  let tempStreak = 1
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime())
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = sortedDates[i - 1]
    const curr = sortedDates[i]
    prev.setHours(0, 0, 0, 0)
    curr.setHours(0, 0, 0, 0)
    const gap = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
    if (gap === 1) {
      tempStreak++
    } else if (gap > 1) {
      longestStreak = Math.max(longestStreak, tempStreak)
      tempStreak = 1
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak)

  return { current: currentStreak, longest: longestStreak }
}

function generateWeeklySummary(entries: any[], moodDistribution: any, streak: { current: number; longest: number }) {
  if (entries.length === 0) return null

  const total = entries.length
  const confidentPct = total > 0 ? Math.round((moodDistribution.confident / total) * 100) : 0
  const anxiousPct = total > 0 ? Math.round((moodDistribution.anxious / total) * 100) : 0

  let moodAssessment = ''
  if (confidentPct > 60) {
    moodAssessment = 'Mood trading Anda sangat positif minggu ini! Keep up the confidence.'
  } else if (anxiousPct > 50) {
    moodAssessment = 'Tingkat anxiety cukup tinggi. Pertimbangkan untuk mengurangi lot size dan lebih disiplin dengan trading plan.'
  } else {
    moodAssessment = 'Mood trading Anda cukup seimbang. Terus jaga emosi dan disiplin!'
  }

  const streakMsg = streak.current > 0
    ? `🔥 Streak journaling: ${streak.current} hari berturut-turut!`
    : '📝 Mulai streak journaling baru hari ini!'

  const recentTopics = entries.slice(0, 3).map(e => `"${e.title}"`).join(', ')

  return {
    moodAssessment,
    streakMessage: streakMsg,
    recentTopics,
    totalEntries: total,
    confidenceLevel: confidentPct > 60 ? 'High' : confidentPct > 30 ? 'Medium' : 'Low',
    recommendation: confidentPct > 60
      ? 'Confidence tinggi = saatnya slightly increase position size. Tapi tetap jaga risk management!'
      : anxiousPct > 40
      ? 'Anxiety tinggi = kurangi risk per trade, fokus pada quality setups, dan istirahat cukup.'
      : 'Mood stabil. Good time untuk menjalankan trading plan dengan konsisten.',
  }
}
