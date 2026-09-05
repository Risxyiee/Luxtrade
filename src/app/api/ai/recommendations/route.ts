import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { geminiPrompt } from '@/lib/gemini'
import { isUserPro } from '@/lib/pro-check'

// In-memory rate limiter (same pattern as /api/ai/route.ts)
const recRateLimit = new Map<string, { count: number; resetAt: number }>()
const REC_RATE_LIMIT = 20
const REC_RATE_WINDOW = 60 * 1000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = recRateLimit.get(userId)
  if (!entry || now > entry.resetAt) {
    recRateLimit.set(userId, { count: 1, resetAt: now + REC_RATE_WINDOW })
    return true
  }
  if (entry.count >= REC_RATE_LIMIT) return false
  entry.count++
  return true
}

// ==================== GEMINI HELPER ====================

async function askGemini(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    return await geminiPrompt(userPrompt, {
      systemInstruction: systemPrompt,
      maxTokens: 4096,
    })
  } catch (error: any) {
    console.warn('[AI Recommendations] Gemini failed, using fallback:', error.message)
    return null
  }
}

// ==================== STAT CALCULATION ====================

interface TradeData {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  profit_loss: number
  session: string | null
  setup_type?: string | null
  open_time: string
  close_time: string
  lot_size?: number
  risk_reward_ratio?: number | null
}

interface AnalyticsData {
  totalTrades: number
  winRate: number
  totalPL: number
  avgProfit: number
  avgLoss: number
  profitFactor: number
  sessionPerformance?: { session: string; trades: number; pl: number; winRate: number }[]
  monthlyPerformance?: { month: string; pl: number; trades: number }[]
}

interface SetupStat {
  setup: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPL: number
  avgPL: number
}

interface SessionStat {
  session: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPL: number
  avgPL: number
}

interface PairStat {
  symbol: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPL: number
  avgPL: number
}

interface DayStat {
  day: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPL: number
  avgPL: number
}

interface CalculatedStats {
  bestSetups: SetupStat[]
  bestSessions: SessionStat[]
  bestPairs: PairStat[]
  bestDays: DayStat[]
}

function calcSetupStats(trades: TradeData[]): SetupStat[] {
  const map = new Map<string, { total: number; wins: number; totalPL: number }>()
  for (const t of trades) {
    const key = t.setup_type || 'unlabeled'
    const s = map.get(key) || { total: 0, wins: 0, totalPL: 0 }
    s.total++
    if (t.profit_loss > 0) s.wins++
    s.totalPL += t.profit_loss
    map.set(key, s)
  }
  return [...map.entries()]
    .map(([setup, s]) => ({
      setup,
      totalTrades: s.total,
      wins: s.wins,
      losses: s.total - s.wins,
      winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
      totalPL: s.totalPL,
      avgPL: s.total > 0 ? s.totalPL / s.total : 0
    }))
    .sort((a, b) => {
      // Primary sort by totalPL, secondary by winRate
      if (b.totalPL !== a.totalPL) return b.totalPL - a.totalPL
      return b.winRate - a.winRate
    })
}

function calcSessionStats(trades: TradeData[]): SessionStat[] {
  const map = new Map<string, { total: number; wins: number; totalPL: number }>()
  for (const t of trades) {
    const key = t.session || 'unknown'
    const s = map.get(key) || { total: 0, wins: 0, totalPL: 0 }
    s.total++
    if (t.profit_loss > 0) s.wins++
    s.totalPL += t.profit_loss
    map.set(key, s)
  }
  return [...map.entries()]
    .map(([session, s]) => ({
      session,
      totalTrades: s.total,
      wins: s.wins,
      losses: s.total - s.wins,
      winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
      totalPL: s.totalPL,
      avgPL: s.total > 0 ? s.totalPL / s.total : 0
    }))
    .sort((a, b) => {
      if (b.totalPL !== a.totalPL) return b.totalPL - a.totalPL
      return b.winRate - a.winRate
    })
}

function calcPairStats(trades: TradeData[]): PairStat[] {
  const map = new Map<string, { total: number; wins: number; totalPL: number }>()
  for (const t of trades) {
    const key = t.symbol
    const s = map.get(key) || { total: 0, wins: 0, totalPL: 0 }
    s.total++
    if (t.profit_loss > 0) s.wins++
    s.totalPL += t.profit_loss
    map.set(key, s)
  }
  return [...map.entries()]
    .map(([symbol, s]) => ({
      symbol,
      totalTrades: s.total,
      wins: s.wins,
      losses: s.total - s.wins,
      winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
      totalPL: s.totalPL,
      avgPL: s.total > 0 ? s.totalPL / s.total : 0
    }))
    .sort((a, b) => {
      if (b.totalPL !== a.totalPL) return b.totalPL - a.totalPL
      return b.winRate - a.winRate
    })
}

function calcDayStats(trades: TradeData[]): DayStat[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const map = new Map<string, { total: number; wins: number; totalPL: number }>()
  for (const t of trades) {
    const d = new Date(t.close_time)
    const day = dayNames[d.getDay()]
    const s = map.get(day) || { total: 0, wins: 0, totalPL: 0 }
    s.total++
    if (t.profit_loss > 0) s.wins++
    s.totalPL += t.profit_loss
    map.set(day, s)
  }
  return [...map.entries()]
    .map(([day, s]) => ({
      day,
      totalTrades: s.total,
      wins: s.wins,
      losses: s.total - s.wins,
      winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
      totalPL: s.totalPL,
      avgPL: s.total > 0 ? s.totalPL / s.total : 0
    }))
    .sort((a, b) => {
      if (b.totalPL !== a.totalPL) return b.totalPL - a.totalPL
      return b.winRate - a.winRate
    })
}

// ==================== SYSTEM PROMPT ====================

function getSystemPrompt(lang: 'id' | 'en'): string {
  return lang === 'id'
    ? `Kamu adalah trading coach AI untuk LuxTrade. Berdasarkan data statistik trading user yang diberikan, berikan 3-5 rekomendasi yang spesifik dan actionable.

Kamu HARUS:
1. SELALU menjawab dalam Bahasa Indonesia yang natural dan profesional
2. HANYA merujuk pada data statistik yang disediakan — JANGAN membuat data
3. Berikan 3-5 rekomendasi spesifik tentang setup, sesi, pair, atau waktu terbaik
4. Gunakan format markdown dan emoji untuk readability
5. Jika ada pola negatif yang jelas (misalnya setup tertentu selalu rugi), sebutkan sebagai warning
6. JANGAN memberikan saran untuk membeli/menjual pair tertentu secara spesifik
7. JANGAN pernah memberikan jawaban template atau generik`
    : `You are an AI trading coach for LuxTrade. Based on the user's trading statistical data provided below, give 3-5 specific, actionable recommendations.

You MUST:
1. Always respond in professional but friendly English
2. ONLY reference the statistics provided — do NOT make up data
3. Give 3-5 specific recommendations about best setups, sessions, pairs, or times to trade
4. Use markdown formatting and emojis for readability
5. If there's a clear negative pattern (e.g., a setup that consistently loses), mention it as a warning
6. NEVER recommend buying/selling specific pairs
7. NEVER give template or generic responses`
}

// ==================== USER PROMPT BUILDER ====================

function buildUserPrompt(lang: 'id' | 'en', stats: CalculatedStats, analytics: AnalyticsData): string {
  const isId = lang === 'id'

  const setupLines = stats.bestSetups.length > 0
    ? stats.bestSetups.map(s => 
        `- ${s.setup}: ${s.totalTrades} trades, WR ${s.winRate.toFixed(1)}%, P/L $${s.totalPL.toFixed(2)}, Avg P/L $${s.avgPL.toFixed(2)}`
      ).join('\n')
    : (isId ? '- Tidak ada data setup_type' : '- No setup_type data available')

  const sessionLines = stats.bestSessions.length > 0
    ? stats.bestSessions.map(s => 
        `- ${s.session}: ${s.totalTrades} trades, WR ${s.winRate.toFixed(1)}%, P/L $${s.totalPL.toFixed(2)}, Avg P/L $${s.avgPL.toFixed(2)}`
      ).join('\n')
    : (isId ? '- Tidak ada data sesi' : '- No session data available')

  const pairLines = stats.bestPairs.length > 0
    ? stats.bestPairs.slice(0, 10).map(s => 
        `- ${s.symbol}: ${s.totalTrades} trades, WR ${s.winRate.toFixed(1)}%, P/L $${s.totalPL.toFixed(2)}, Avg P/L $${s.avgPL.toFixed(2)}`
      ).join('\n')
    : (isId ? '- Tidak ada data pair' : '- No pair data available')

  const dayLines = stats.bestDays.length > 0
    ? stats.bestDays.map(s => 
        `- ${s.day}: ${s.totalTrades} trades, WR ${s.winRate.toFixed(1)}%, P/L $${s.totalPL.toFixed(2)}, Avg P/L $${s.avgPL.toFixed(2)}`
      ).join('\n')
    : (isId ? '- Tidak ada data hari' : '- No day data available')

  if (isId) {
    return `Berikut adalah data statistik trading user:

**Data Umum:**
- Total Trades: ${analytics.totalTrades}
- Win Rate: ${analytics.winRate.toFixed(1)}%
- Total P/L: $${analytics.totalPL.toFixed(2)}
- Avg Profit: $${analytics.avgProfit.toFixed(2)}
- Avg Loss: $${analytics.avgLoss.toFixed(2)}
- Profit Factor: ${analytics.profitFactor.toFixed(2)}

**Performa per Setup Type:**
${setupLines}

**Performa per Sesi:**
${sessionLines}

**Performa per Pair (Top 10):**
${pairLines}

**Performa per Hari:**
${dayLines}

Berdasarkan data di atas, berikan 3-5 rekomendasi spesifik yang actionable untuk meningkatkan performa trading user.`
  }

  return `Here is the user's trading statistics:

**Overall Data:**
- Total Trades: ${analytics.totalTrades}
- Win Rate: ${analytics.winRate.toFixed(1)}%
- Total P/L: $${analytics.totalPL.toFixed(2)}
- Avg Profit: $${analytics.avgProfit.toFixed(2)}
- Avg Loss: $${analytics.avgLoss.toFixed(2)}
- Profit Factor: ${analytics.profitFactor.toFixed(2)}

**Performance by Setup Type:**
${setupLines}

**Performance by Session:**
${sessionLines}

**Performance by Pair (Top 10):**
${pairLines}

**Performance by Day:**
${dayLines}

Based on the data above, provide 3-5 specific, actionable recommendations to improve the user's trading performance.`
}

// ==================== SMART FALLBACK ====================

function generateFallbackRecommendations(lang: 'id' | 'en', stats: CalculatedStats, analytics: AnalyticsData): string {
  const isId = lang === 'id'
  const recs: string[] = []

  // Best setup recommendation
  if (stats.bestSetups.length > 0) {
    const best = stats.bestSetups[0]
    const worst = stats.bestSetups[stats.bestSetups.length - 1]
    if (best.setup !== 'unlabeled') {
      recs.push(
        isId
          ? `🎯 **Fokus pada setup ${best.setup}** — WR ${best.winRate.toFixed(1)}% dengan rata-rata P/L $${best.avgPL.toFixed(2)} per trade. Ini adalah setup terbaik Anda.`
          : `🎯 **Focus on ${best.setup} setups** — ${best.winRate.toFixed(1)}% WR with an average P/L of $${best.avgPL.toFixed(2)} per trade. This is your best performing setup.`
      )
    }
    if (worst.setup !== 'unlabeled' && worst.setup !== best.setup && worst.totalTrades >= 3) {
      recs.push(
        isId
          ? `⚠️ **Kurangi setup ${worst.setup}** — WR hanya ${worst.winRate.toFixed(1)}% dengan total kerugian $${Math.abs(worst.totalPL).toFixed(2)}. Pertimbangkan untuk menghindari setup ini.`
          : `⚠️ **Reduce ${worst.setup} setups** — Only ${worst.winRate.toFixed(1)}% WR with a total loss of $${Math.abs(worst.totalPL).toFixed(2)}. Consider avoiding this setup.`
      )
    }
  }

  // Best session recommendation
  if (stats.bestSessions.length > 0) {
    const best = stats.bestSessions[0]
    if (best.session !== 'unknown') {
      recs.push(
        isId
          ? `🕐 **Sesi terbaik: ${best.session}** — ${best.totalTrades} trades dengan P/L $${best.totalPL.toFixed(2)}. Jadwalkan trading utama Anda di sesi ini.`
          : `🕐 **Best session: ${best.session}** — ${best.totalTrades} trades with P/L of $${best.totalPL.toFixed(2)}. Schedule your main trading during this session.`
      )
    }
  }

  // Best pair recommendation
  if (stats.bestPairs.length > 0) {
    const top = stats.bestPairs.slice(0, 3).map(p => `${p.symbol} (WR ${p.winRate.toFixed(1)}%, P/L $${p.totalPL.toFixed(2)})`)
    recs.push(
      isId
        ? `💰 **Pair terbaik Anda: ${top.join(', ')}**. Fokuskan energi pada pair-pair ini untuk hasil optimal.`
        : `💰 **Your best pairs: ${top.join(', ')}**. Focus your energy on these pairs for optimal results.`
    )
  }

  // Best day recommendation
  if (stats.bestDays.length > 0) {
    const best = stats.bestDays[0]
    recs.push(
      isId
        ? `📅 **Hari terbaik: ${best.day}** — WR ${best.winRate.toFixed(1)}% dan P/L $${best.totalPL.toFixed(2)}. Prioritaskan trading aktif di hari ini.`
        : `📅 **Best day: ${best.day}** — ${best.winRate.toFixed(1)}% WR and P/L of $${best.totalPL.toFixed(2)}. Prioritize active trading on this day.`
    )
  }

  // Overall performance insight
  if (analytics.winRate > 60) {
    recs.push(
      isId
        ? `✅ **Win Rate Anda ${analytics.winRate.toFixed(1)}% sudah bagus!** Fokus pada memperbesar ukuran winner dan mengecilkan loser untuk meningkatkan profit factor saat ini (${analytics.profitFactor.toFixed(2)}).`
        : `✅ **Your ${analytics.winRate.toFixed(1)}% win rate is solid!** Focus on sizing up your winners and cutting losers to improve your current profit factor (${analytics.profitFactor.toFixed(2)}).`
    )
  } else if (analytics.winRate < 45) {
    recs.push(
      isId
        ? `📉 **Win Rate ${analytics.winRate.toFixed(1)}% perlu ditingkatkan.** Kurangi jumlah trade dan hanya masuk setup dengan konfirmasi kuat. Kualitas > kuantitas.`
        : `📉 **Win rate of ${analytics.winRate.toFixed(1)}% needs improvement.** Reduce trade count and only enter setups with strong confirmation. Quality over quantity.`
    )
  }

  if (recs.length === 0) {
    recs.push(
      isId
        ? '📊 Tambahkan lebih banyak trade dengan setup_type dan session yang terisi agar AI bisa memberikan rekomendasi yang lebih spesifik.'
        : '📊 Add more trades with setup_type and session filled in so AI can provide more specific recommendations.'
    )
  }

  return recs.join('\n\n')
}

// ==================== POST HANDLER ====================

export async function POST(request: NextRequest) {
  // 1. Auth check
  const authResult = await requireAuth(request)
  const response = authResult.response
  const user = authResult.user
  if (response) return response
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. PRO check
  const pro = await isUserPro(user.id)
  if (!pro) {
    return NextResponse.json({ error: 'PRO feature' }, { status: 403 })
  }

  // 3. Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
  }

  // 4. Parse body
  let body: { trades: TradeData[]; analytics: AnalyticsData; language: 'id' | 'en' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { trades, analytics, language = 'id' } = body

  if (!trades || !Array.isArray(trades) || trades.length === 0) {
    return NextResponse.json({ error: 'trades array is required and must not be empty' }, { status: 400 })
  }

  if (!analytics || typeof analytics !== 'object') {
    return NextResponse.json({ error: 'analytics object is required' }, { status: 400 })
  }

  // 5. Calculate stats from raw trade data
  const stats: CalculatedStats = {
    bestSetups: calcSetupStats(trades),
    bestSessions: calcSessionStats(trades),
    bestPairs: calcPairStats(trades),
    bestDays: calcDayStats(trades)
  }

  // 6. Call ZAI with stats
  const systemPrompt = getSystemPrompt(language)
  const userPrompt = buildUserPrompt(language, stats, analytics)
  const aiResult = await askGemini(systemPrompt, userPrompt)

  // 7. Fallback if Gemini fails
  const recommendations = aiResult || generateFallbackRecommendations(language, stats, analytics)

  return NextResponse.json({
    recommendations,
    stats: {
      bestSetups: stats.bestSetups,
      bestSessions: stats.bestSessions,
      bestPairs: stats.bestPairs,
      bestDays: stats.bestDays
    }
  })
}
