import { NextRequest, NextResponse } from 'next/server'

// In-memory cache
let sentimentCache: { sentiment: string; score: number; trend: string; timestamp: number } | null = null
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

interface SentimentKeywords {
  bullish: string[]
  bearish: string[]
}

// Trading sentiment keywords (commonly used in forex/crypto markets)
const KEYWORDS: SentimentKeywords = {
  bullish: [
    'surge', 'rally', 'gains', 'rise', 'rises', 'climbs', 'jump', 'jumps', 'soar', 'soars',
    'rebound', 'recovers', 'strengthens', 'upward', 'positive', 'optimistic', 'bullish',
    'breakout', 'support', 'buy', 'buying', 'demand', 'growth', 'expansion', 'boost',
    'record high', 'all-time high', 'rallies', 'advanced', 'outperformed', 'beats',
    'beat expectations', 'exceeds', 'higher', 'above expectations', 'strong',
    'robust', 'solid', 'healthy', 'bright', 'encouraging', 'promising',
    'upside', 'bull market', 'uptrend', 'momentum', 'accelerates', 'surprising',
  ],
  bearish: [
    'plunge', 'tumble', 'slump', 'fall', 'falls', 'decline', 'declines', 'drop', 'drops',
    'slide', 'slides', 'sank', 'weakens', 'downward', 'negative', 'pessimistic', 'bearish',
    'breakdown', 'resistance', 'sell', 'selling', 'supply', 'contraction', 'cut',
    'record low', 'crash', 'collapses', 'collapsed', 'underperformed', 'misses',
    'missed expectations', 'below expectations', 'weaker', 'lower', 'weak',
    'sluggish', 'poor', 'concern', 'worries', 'fears', 'risk', 'risks',
    'downside', 'bear market', 'downtrend', 'recession', 'downturn', 'decelerates',
  ],
}

/**
 * Analyze sentiment from news title and snippet
 * Returns sentiment score (-100 to 100), sentiment label, and trend
 */
function analyzeSentiment(title: string, snippet: string): {
  score: number
  sentiment: string
  trend: string
} {
  const text = `${title} ${snippet}`.toLowerCase()

  let bullishCount = 0
  let bearishCount = 0

  // Count bullish keywords
  for (const keyword of KEYWORDS.bullish) {
    const matches = (text.match(new RegExp(keyword, 'gi')) || []).length
    bullishCount += matches
  }

  // Count bearish keywords
  for (const keyword of KEYWORDS.bearish) {
    const matches = (text.match(new RegExp(keyword, 'gi')) || []).length
    bearishCount += matches
  }

  const total = bullishCount + bearishCount
  let score = 0

  if (total > 0) {
    // Normalize to -100 to 100
    score = ((bullishCount - bearishCount) / total) * 100
  }

  // Determine sentiment label
  let sentiment = 'neutral'
  if (score > 20) {
    sentiment = 'bullish'
  } else if (score < -20) {
    sentiment = 'bearish'
  }

  // Determine trend
  let trend = 'stable'
  if (score > 40) {
    trend = 'strong_up'
  } else if (score > 20) {
    trend = 'up'
  } else if (score < -40) {
    trend = 'strong_down'
  } else if (score < -20) {
    trend = 'down'
  }

  return { score, sentiment, trend }
}

/**
 * Fetch news from the existing news API
 */
async function fetchNewsItems(): Promise<
  Array<{ title: string; snippet: string; type: string }>
> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/news?format=full`,
      { cache: 'no-store' }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch news')
    }

    const data = await response.json()
    return (data.news || []).map((item: any) => ({
      title: item.title,
      snippet: item.snippet || '',
      type: item.type,
    }))
  } catch (error) {
    console.error('Sentiment API - Failed to fetch news:', error)
    return []
  }
}

/**
 * Calculate overall market sentiment from multiple news items
 */
function calculateOverallSentiment(
  newsItems: Array<{ title: string; snippet: string; type: string }>
): {
  score: number
  sentiment: string
  trend: string
  bullishCount: number
  bearishCount: number
  neutralCount: number
  analyzedItems: number
} {
  if (newsItems.length === 0) {
    return {
      score: 0,
      sentiment: 'neutral',
      trend: 'stable',
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      analyzedItems: 0,
    }
  }

  let totalScore = 0
  let bullishCount = 0
  let bearishCount = 0
  let neutralCount = 0

  for (const item of newsItems) {
    const { score: itemScore, sentiment: itemSentiment } = analyzeSentiment(
      item.title,
      item.snippet
    )
    totalScore += itemScore

    if (itemSentiment === 'bullish') {
      bullishCount++
    } else if (itemSentiment === 'bearish') {
      bearishCount++
    } else {
      neutralCount++
    }
  }

  const avgScore = totalScore / newsItems.length

  // Determine overall sentiment
  let sentiment = 'neutral'
  if (avgScore > 15) {
    sentiment = 'bullish'
  } else if (avgScore < -15) {
    sentiment = 'bearish'
  }

  // Determine overall trend
  let trend = 'stable'
  if (avgScore > 30) {
    trend = 'strong_up'
  } else if (avgScore > 15) {
    trend = 'up'
  } else if (avgScore < -30) {
    trend = 'strong_down'
  } else if (avgScore < -15) {
    trend = 'down'
  }

  return {
    score: Math.round(avgScore),
    sentiment,
    trend,
    bullishCount,
    bearishCount,
    neutralCount,
    analyzedItems: newsItems.length,
  }
}

/**
 * GET - Get market sentiment analysis
 */
export async function GET(request: NextRequest) {
  try {
    // Check cache
    if (sentimentCache && Date.now() - sentimentCache.timestamp < CACHE_DURATION) {
      console.log('[Sentiment] Returning cached sentiment')
      return NextResponse.json({
        success: true,
        cached: true,
        ...sentimentCache,
      })
    }

    // Fetch news items
    const newsItems = await fetchNewsItems()

    // Calculate sentiment (prioritize high and medium impact news)
    const highImpactNews = newsItems.filter((item) =>
      ['high', 'medium'].includes(item.type)
    )
    const newsToAnalyze =
      highImpactNews.length > 0 ? highImpactNews : newsItems.slice(0, 10)

    const result = calculateOverallSentiment(newsToAnalyze)

    // Update cache
    sentimentCache = {
      sentiment: result.sentiment,
      score: result.score,
      trend: result.trend,
      timestamp: Date.now(),
    }

    console.log(
      `[Sentiment] Analyzed ${result.analyzedItems} news items: ${result.sentiment} (${result.score})`
    )

    return NextResponse.json({
      success: true,
      cached: false,
      ...result,
      analyzedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Sentiment] API error:', error)

    return NextResponse.json({
      success: true,
      fallback: true,
      sentiment: 'neutral',
      score: 0,
      trend: 'stable',
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      analyzedItems: 0,
      message: 'Market sentiment analysis temporarily unavailable',
      analyzedAt: new Date().toISOString(),
    })
  }
}