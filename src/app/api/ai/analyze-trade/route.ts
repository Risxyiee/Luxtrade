import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'
import { geminiPrompt, isGeminiAvailable } from '@/lib/gemini'

/**
 * AI Trade Analysis API
 * Provides AI-powered analysis of trading performance using Gemini
 * Falls back to rule-based analysis when Gemini is unavailable
 */

const SYSTEM_PROMPT = `You are an AI trading analyst for LuxTradee. Analyze the user's trading data and provide actionable insights. Be specific, data-driven, and practical. Use markdown formatting for readability. Reference actual numbers from the data when making observations. Keep your analysis concise but thorough.`

export async function POST(req: Request) {
  try {
    // Auth check
    const result = await createClientForApi(req as NextRequest)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // PRO check - AI trade analysis is a PRO feature
    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({
        error: 'AI Trade Analysis adalah fitur PRO. Upgrade ke PRO untuk menggunakan fitur ini!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
    }

    const { trades, question } = await req.json()

    if (!trades || !Array.isArray(trades)) {
      return NextResponse.json(
        { error: 'Trades data is required' },
        { status: 400 }
      )
    }

    // Calculate basic statistics
    const totalTrades = trades.length
    const winningTrades = trades.filter((t: any) => t.profit_loss > 0).length
    const losingTrades = trades.filter((t: any) => t.profit_loss < 0).length
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
    const totalPL = trades.reduce((sum: number, t: any) => sum + t.profit_loss, 0)
    const avgProfit = trades.filter((t: any) => t.profit_loss > 0).reduce((sum: number, t: any) => sum + t.profit_loss, 0) / (winningTrades || 1)
    const avgLoss = Math.abs(trades.filter((t: any) => t.profit_loss < 0).reduce((sum: number, t: any) => sum + t.profit_loss, 0)) / (losingTrades || 1)
    const profitFactor = avgLoss > 0 ? avgProfit / avgLoss : totalPL > 0 ? 999 : 0

    const statistics = {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPL,
      avgProfit,
      avgLoss,
      profitFactor
    }

    // Build trade summary for AI context (last 20 trades)
    const recentTrades = trades.slice(-20).map((t: any) => ({
      symbol: t.symbol || 'N/A',
      type: t.type || 'N/A',
      profit_loss: t.profit_loss ?? 0,
      session: t.session || 'N/A',
      open_time: t.open_time || 'N/A',
    }))

    // Build the user prompt with statistics and trade context
    const statsContext = `## Trading Statistics
- Total Trades: ${totalTrades}
- Winning Trades: ${winningTrades}
- Losing Trades: ${losingTrades}
- Win Rate: ${winRate.toFixed(1)}%
- Total P/L: $${totalPL.toFixed(2)}
- Avg Profit: $${avgProfit.toFixed(2)}
- Avg Loss: $${avgLoss.toFixed(2)}
- Profit Factor: ${profitFactor.toFixed(2)}`

    const tradesContext = `## Recent Trades (last ${recentTrades.length})
${JSON.stringify(recentTrades, null, 2)}`

    // Determine the analysis prompt based on question type
    let analysisPrompt = ''
    if (!question || question === 'general') {
      analysisPrompt = `${statsContext}\n\n${tradesContext}\n\nProvide a comprehensive general analysis of this trading performance. Cover overall profitability, win rate assessment, risk management quality, and any notable patterns you see in the recent trades. Be specific with numbers.`
    } else if (question === 'improvement') {
      analysisPrompt = `${statsContext}\n\n${tradesContext}\n\nBased on this trading data, provide specific, actionable improvement suggestions. Focus on the weakest aspects first. Reference the actual numbers. Prioritize suggestions by expected impact.`
    } else if (question === 'strengths') {
      analysisPrompt = `${statsContext}\n\n${tradesContext}\n\nIdentify and analyze the key strengths in this trading performance. What is the trader doing well? Which patterns or habits are contributing positively? Reference actual data points.`
    } else {
      // Custom question
      analysisPrompt = `${statsContext}\n\n${tradesContext}\n\nAnswer the following question about this trading data: "${question}"`
    }

    // Try Gemini first, fall back to rule-based on failure
    let analysis = ''
    let source: 'gemini' | 'fallback' = 'fallback'

    if (isGeminiAvailable()) {
      try {
        const geminiResult = await geminiPrompt(analysisPrompt, {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.7,
          maxTokens: 2048,
          timeoutMs: 30000, // 30s timeout
        })

        if (geminiResult && geminiResult.trim().length > 0) {
          analysis = geminiResult
          source = 'gemini'
        } else {
          // Empty response from Gemini, fall back
          console.warn('[AI /analyze-trade] Gemini returned empty response, using fallback')
          analysis = fallbackAnalysis(question, trades, statistics)
        }
      } catch (geminiError: any) {
        // Handle Gemini errors gracefully — rate limit, timeout, API errors, etc.
        const errMsg = geminiError?.message || String(geminiError)
        console.warn(`[AI /analyze-trade] Gemini failed (${errMsg}), using fallback`)
        analysis = fallbackAnalysis(question, trades, statistics)
      }
    } else {
      // Gemini not configured
      console.info('[AI /analyze-trade] Gemini not available, using fallback')
      analysis = fallbackAnalysis(question, trades, statistics)
    }

    return NextResponse.json({
      success: true,
      analysis,
      source,
      statistics
    })
  } catch (error: any) {
    console.error('[AI /analyze-trade] Error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze trades' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Fallback: Rule-based analysis (used when Gemini is unavailable or fails)
// ---------------------------------------------------------------------------

function fallbackAnalysis(
  question: string | undefined,
  trades: any[],
  stats: { totalTrades: number; winningTrades: number; losingTrades: number; winRate: number; totalPL: number; avgProfit: number; avgLoss: number; profitFactor: number }
): string {
  if (!question || question === 'general') {
    return generateGeneralAnalysis(stats)
  } else if (question === 'improvement') {
    return generateImprovementSuggestions(stats)
  } else if (question === 'strengths') {
    return generateStrengths(stats)
  } else {
    return generateCustomAnalysis(trades, question)
  }
}

function generateGeneralAnalysis(stats: any): string {
  const { totalTrades, winRate, totalPL, profitFactor } = stats

  let analysis = `## 📊 Trading Performance Analysis\n\n`

  // Overall performance
  analysis += `**Overall Performance:**\n`
  if (totalPL > 0) {
    analysis += `✅ You're profitable with +$${totalPL.toFixed(2)} total profit!\n`
  } else {
    analysis += `⚠️ Currently at -$${Math.abs(totalPL).toFixed(2)}. Focus on reducing losses.\n`
  }

  analysis += `\n`

  // Win rate analysis
  analysis += `**Win Rate:** ${winRate.toFixed(1)}%\n`
  if (winRate >= 60) {
    analysis += `✅ Excellent win rate! Above 60% is very good.\n`
  } else if (winRate >= 50) {
    analysis += `📈 Win rate is decent. Aim for 60%+ for better results.\n`
  } else {
    analysis += `❌ Win rate below 50%. Review your entry conditions and risk management.\n`
  }

  analysis += `\n`

  // Profit factor
  analysis += `**Profit Factor:** ${profitFactor.toFixed(2)}\n`
  if (profitFactor >= 2) {
    analysis += `🎯 Outstanding! Profit factor above 2.0 indicates excellent risk management.\n`
  } else if (profitFactor >= 1.5) {
    analysis += `👍 Good! Profit factor above 1.5 is healthy.\n`
  } else if (profitFactor >= 1) {
    analysis += `⚠️ Profit factor at breakeven. Need to improve win rate or reduce losses.\n`
  } else {
    analysis += `❌ Profit factor below 1.0. Losing more than winning. Critical review needed.\n`
  }

  return analysis
}

function generateImprovementSuggestions(stats: any): string {
  const { winRate, profitFactor, totalTrades } = stats

  let suggestions = `## 💡 Improvement Suggestions\n\n`

  if (winRate < 50) {
    suggestions += `### 1. Improve Win Rate\n`
    suggestions += `- Review your entry conditions and be more selective\n`
    suggestions += `- Only trade when all your criteria are met\n`
    suggestions += `- Consider reducing position size during losing streaks\n\n`
  }

  if (profitFactor < 1.5) {
    suggestions += `### 2. Improve Risk Management\n`
    suggestions += `- Ensure your risk:reward ratio is at least 1:2\n`
    suggestions += `- Use stop losses consistently\n`
    suggestions += `- Don't let losing trades run too long\n\n`
  }

  if (totalTrades < 20) {
    suggestions += `### 3. Increase Sample Size\n`
    suggestions += `- Need more trades for reliable statistics\n`
    suggestions += `- Aim for at least 30-50 trades before making major adjustments\n\n`
  }

  suggestions += `### 4. General Tips\n`
  suggestions += `- Keep a detailed trading journal\n`
  suggestions += `- Review your trades weekly\n`
  suggestions += `- Stick to your trading plan\n`
  suggestions += `- Manage emotions during trading\n`

  return suggestions
}

function generateStrengths(stats: any): string {
  const { winRate, totalPL, profitFactor } = stats

  let strengths = `## 🌟 Trading Strengths\n\n`

  if (winRate >= 60) {
    strengths += `✅ **High Win Rate**: ${winRate.toFixed(1)}% - Excellent trade selection!\n\n`
  }

  if (totalPL > 0) {
    strengths += `✅ **Profitable**: +$${totalPL.toFixed(2)} - You're making money!\n\n`
  }

  if (profitFactor >= 2) {
    strengths += `✅ **Excellent Risk Management**: Profit factor of ${profitFactor.toFixed(2)} - Great balance of wins and losses!\n\n`
  }

  if (winRate >= 50 && profitFactor >= 1.5) {
    strengths += `✅ **Consistent Performance**: Good win rate and profit factor indicate a reliable trading system.\n\n`
  }

  if (strengths === `## 🌟 Trading Strengths\n\n`) {
    strengths += `Keep working on your trading! Focus on improving win rate and profit factor.\n\n`
  }

  return strengths
}

function generateCustomAnalysis(trades: any[], question: string): string {
  // Simple keyword-based analysis for custom questions
  const lowerQuestion = question.toLowerCase()

  if (lowerQuestion.includes('session') || lowerQuestion.includes('time')) {
    const sessionStats: Record<string, { count: number; pl: number; wins: number }> = {}

    trades.forEach((t: any) => {
      const session = t.session || 'Unknown'
      if (!sessionStats[session]) {
        sessionStats[session] = { count: 0, pl: 0, wins: 0 }
      }
      sessionStats[session].count++
      sessionStats[session].pl += t.profit_loss
      if (t.profit_loss > 0) sessionStats[session].wins++
    })

    let analysis = `## 🕐 Session Analysis\n\n`
    Object.entries(sessionStats).forEach(([session, stats]) => {
      const wr = (stats.wins / stats.count * 100).toFixed(1)
      analysis += `**${session}**: ${stats.count} trades, +$${stats.pl.toFixed(2)}, ${wr}% WR\n`
    })

    return analysis
  }

  if (lowerQuestion.includes('symbol') || lowerQuestion.includes('pair')) {
    const symbolStats: Record<string, { count: number; pl: number; wins: number }> = {}

    trades.forEach((t: any) => {
      const symbol = t.symbol || 'Unknown'
      if (!symbolStats[symbol]) {
        symbolStats[symbol] = { count: 0, pl: 0, wins: 0 }
      }
      symbolStats[symbol].count++
      symbolStats[symbol].pl += t.profit_loss
      if (t.profit_loss > 0) symbolStats[symbol].wins++
    })

    let analysis = `## 💱 Symbol Analysis\n\n`
    Object.entries(symbolStats)
      .sort((a, b) => b[1].pl - a[1].pl)
      .forEach(([symbol, stats]) => {
        const wr = (stats.wins / stats.count * 100).toFixed(1)
        analysis += `**${symbol}**: ${stats.count} trades, +$${stats.pl.toFixed(2)}, ${wr}% WR\n`
      })

    return analysis
  }

  return `## 🤖 AI Analysis\n\nBased on your ${trades.length} trades, here's a custom analysis:\n\nFocus on improving your win rate and profit factor. Keep a detailed journal and review your trades regularly.`
}
