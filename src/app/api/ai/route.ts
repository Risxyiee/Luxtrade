export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createZAI } from '@/lib/zai'
import { isUserPro } from '@/lib/pro-check'

// In-memory rate limiter
const aiRateLimit = new Map<string, { count: number; resetAt: number }>()
const AI_RATE_LIMIT = 20
const AI_RATE_WINDOW = 60 * 1000

function checkAIRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = aiRateLimit.get(userId)
  if (!entry || now > entry.resetAt) {
    aiRateLimit.set(userId, { count: 1, resetAt: now + AI_RATE_WINDOW })
    return true
  }
  if (entry.count >= AI_RATE_LIMIT) return false
  entry.count++
  return true
}

// ==================== ZAI HELPER ====================

async function askZAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const zai = await createZAI()
    const result = await zai.chat.completions.create({
      model: 'glm-4.6',
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      thinking: { type: 'disabled' }
    })
    return result.choices?.[0]?.message?.content || ''
  } catch (error: any) {
    console.warn('[AI] ZAI failed, using fallback:', error.message)
    return null
  }
}

async function askZAIVision(systemPrompt: string, imageBase64: string): Promise<string | null> {
  try {
    const zai = await createZAI()
    const result = await zai.chat.completions.createVision({
      model: 'glm-4.6',
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: [
          { type: 'text', text: 'Analyze this trading chart screenshot:' },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ] }
      ],
      thinking: { type: 'disabled' }
    })
    return result.choices?.[0]?.message?.content || ''
  } catch (error: any) {
    console.warn('[AI] ZAI Vision failed:', error.message)
    return null
  }
}

// ==================== SYSTEM PROMPTS ====================

function getSystemPrompt(lang: 'id' | 'en'): string {
  return lang === 'id'
    ? `Kamu adalah AI Trading Coach untuk LuxTrade, platform jurnal trading Indonesia. 
Kamu harus:
1. SELALU menjawab dalam Bahasa Indonesia yang natural dan profesional — bukan terjemahan kaku
2. Gunakan istilah trading yang familiar di Indonesia (lot, pips, stop loss, take profit, scalping, swing, dll)
3. Berikan saran yang actionable dan spesifik berdasarkan data trading user
4. Format jawaban dengan emoji dan markdown untuk readability
5. Jika data tidak cukup, katakan dengan jelas dan sarankan apa yang perlu dilakukan
6. Jangan pernah menyarankan untuk membeli/menjual pair tertentu secara spesifik
7. JANGAN pernah memberikan jawaban template atau generik. Setiap jawaban HARUS berbeda dan spesifik berdasarkan data yang diberikan.`
    : `You are an AI Trading Coach for LuxTrade, a trading journal platform.
You should:
1. Always respond in English, professional but friendly
2. Use common trading terminology (lot, pips, stop loss, take profit, scalping, swing, etc.)
3. Provide actionable and specific advice based on the user's trading data
4. Format responses with emojis and markdown for readability
5. If data is insufficient, clearly say so and suggest what to do
6. Never recommend buying/selling specific pairs
7. NEVER give template or generic responses. Every answer MUST be unique and specific to the data provided.`
}

// ==================== DATA-DRIVEN PROMPT BUILDERS ====================

function buildPerformancePrompt(lang: 'id' | 'en', data: Record<string, any>): string {
  const d = data
  const sessions = d.sessionPerformance || []
  const monthly = d.monthlyPerformance || []
  const isId = lang === 'id'

  // Find best/worst session
  const bestSession = sessions.length > 0 ? [...sessions].sort((a: any, b: any) => b.pl - a.pl)[0] : null
  const worstSession = sessions.length > 0 ? [...sessions].sort((a: any, b: any) => a.pl - b.pl)[0] : null

  // Find best/worst month
  const bestMonth = monthly.length > 0 ? [...monthly].sort((a: any, b: any) => b.pl - a.pl)[0] : null
  const worstMonth = monthly.length > 0 ? [...monthly].sort((a: any, b: any) => a.pl - b.pl)[0] : null

  // Calculate consistency
  const plValues = monthly.map((m: any) => m.pl)
  const profitableMonths = plValues.filter((p: number) => p > 0).length
  const consistency = monthly.length > 0 ? ((profitableMonths / monthly.length) * 100).toFixed(0) : 'N/A'

  // Risk-reward from avg profit/loss
  const rr = (d.avgLoss > 0 && d.avgProfit > 0) ? (d.avgProfit / Math.abs(d.avgLoss)).toFixed(2) : 'N/A'

  // Expected value per trade
  const ev = d.winRate > 0 && d.avgProfit > 0 && d.avgLoss > 0
    ? ((d.winRate / 100 * d.avgProfit) - ((1 - d.winRate / 100) * Math.abs(d.avgLoss))).toFixed(2)
    : 'N/A'

  // Build monthly trend lines - extracted from template literal to avoid nesting
  const monthlyTrendLine = monthly.length > 0
    ? '\n**Tren 6 Bulan Terakhir:**\n' + monthly.slice(-6).map((m: any) => `  ${m.month}: P/L $${m.pl?.toFixed(0)}, ${m.trades} trades`).join('\n')
    : ''
  const monthlyTrendLineEn = monthly.length > 0
    ? '\n**Last 6 Months Trend:**\n' + monthly.slice(-6).map((m: any) => `  ${m.month}: P/L $${m.pl?.toFixed(0)}, ${m.trades} trades`).join('\n')
    : ''

  // Build session/month detail lines - extracted from template literal to avoid nesting
  const bestSessionLine = bestSession ? `\n**Sesi Terbaik:** ${bestSession.session} — ${bestSession.trades} trades, P/L $${bestSession.pl?.toFixed(0)}, WR ${bestSession.winRate?.toFixed(0)}%` : ''
  const worstSessionLine = worstSession ? `**Sesi Terlemah:** ${worstSession.session} — ${worstSession.trades} trades, P/L $${worstSession.pl?.toFixed(0)}, WR ${worstSession.winRate?.toFixed(0)}%` : ''
  const bestMonthLine = bestMonth ? `\n**Bulan Terbaik:** ${bestMonth.month} — P/L $${bestMonth.pl?.toFixed(0)}, ${bestMonth.trades} trades` : ''
  const worstMonthLine = worstMonth ? `**Bulan Terlemah:** ${worstMonth.month} — P/L $${worstMonth.pl?.toFixed(0)}, ${worstMonth.trades} trades` : ''

  const bestSessionLineEn = bestSession ? `\n**Best Session:** ${bestSession.session} — ${bestSession.trades} trades, P/L $${bestSession.pl?.toFixed(0)}, WR ${bestSession.winRate?.toFixed(0)}%` : ''
  const worstSessionLineEn = worstSession ? `**Worst Session:** ${worstSession.session} — ${worstSession.trades} trades, P/L $${worstSession.pl?.toFixed(0)}, WR ${worstSession.winRate?.toFixed(0)}%` : ''
  const bestMonthLineEn = bestMonth ? `\n**Best Month:** ${bestMonth.month} — P/L $${bestMonth.pl?.toFixed(0)}, ${bestMonth.trades} trades` : ''
  const worstMonthLineEn = worstMonth ? `**Worst Month:** ${worstMonth.month} — P/L $${worstMonth.pl?.toFixed(0)}, ${worstMonth.trades} trades` : ''

  let prompt = isId
    ? `Analisis mendalam performa trading saya dan berikan rekomendasi SPESIFIK:

**Data Inti:**
- Total Trades: ${d.totalTrades || 0}
- Win Rate: ${d.winRate?.toFixed(1) || 0}%
- Total P/L: $${d.totalPL?.toFixed(2) || 0}
- Avg Profit: $${d.avgProfit?.toFixed(2) || 0}
- Avg Loss: $${d.avgLoss?.toFixed(2) || 0}
- Profit Factor: ${d.profitFactor?.toFixed(2) || 0}
- Max Drawdown: $${d.maxDrawdown?.toFixed(2) || 0}
- Sharpe Ratio: ${d.sharpeRatio?.toFixed(2) || 0}
- Risk:Reward Ratio: ${rr}:1
- Expected Value per Trade: $${ev}
- Consistency (profitable months): ${consistency}%
${bestSessionLine}
${worstSessionLine}
${bestMonthLine}
${worstMonthLine}
${monthlyTrendLine}

Berdasarkan data di atas, berikan:
1. Diagnosis utama: APA masalah terbesar saya? (jangan bilang "mungkin" — tentukan!)
2. 3 rekomendasi CONCRETE yang bisa langsung saya terapkan
3. Target realistis untuk bulan depan berdasarkan pola data saya
4. Pair dan sesi mana yang sebaiknya saya fokuskan? (berdasarkan data)`
    : `Deep analysis of my trading performance with SPECIFIC recommendations:

**Core Data:**
- Total Trades: ${d.totalTrades || 0}
- Win Rate: ${d.winRate?.toFixed(1) || 0}%
- Total P/L: $${d.totalPL?.toFixed(2) || 0}
- Avg Profit: $${d.avgProfit?.toFixed(2) || 0}
- Avg Loss: $${d.avgLoss?.toFixed(2) || 0}
- Profit Factor: ${d.profitFactor?.toFixed(2) || 0}
- Max Drawdown: $${d.maxDrawdown?.toFixed(2) || 0}
- Sharpe Ratio: ${d.sharpeRatio?.toFixed(2) || 0}
- Risk:Reward Ratio: ${rr}:1
- Expected Value per Trade: $${ev}
- Consistency (profitable months): ${consistency}%
${bestSessionLineEn}
${worstSessionLineEn}
${bestMonthLineEn}
${worstMonthLineEn}
${monthlyTrendLineEn}

Based on the data above, provide:
1. Main diagnosis: WHAT is my biggest problem? (don't say "maybe" — be definitive!)
2. 3 CONCRETE recommendations I can apply immediately
3. Realistic target for next month based on my data patterns
4. Which pairs and sessions should I focus on? (based on data)`

  return prompt
}

function buildTradeAnalysisPrompt(lang: 'id' | 'en', trade: any): string {
  const recent = trade._recentTrades || []
  const stats = trade._analytics || {}
  const isId = lang === 'id'

  // Analyze recent trade patterns
  const winStreaks = calculateStreaks(recent)
  const symbolStats = getSymbolStats(recent, trade.symbol)
  const sessionStats = getSessionStats(recent)

  // Build recent trades list - extracted to avoid nesting
  const recentTradesList = recent.slice(0, 20).map((t: any) => `  ${t.type} ${t.symbol}: $${t.profit_loss?.toFixed(2) || 0} | Sesi: ${t.session || '-'} | ${t.notes?.substring(0, 40) || '-'}`).join('\n')
  const recentTradesListEn = recent.slice(0, 20).map((t: any) => `  ${t.type} ${t.symbol}: $${t.profit_loss?.toFixed(2) || 0} | Session: ${t.session || '-'} | ${t.notes?.substring(0, 40) || '-'}`).join('\n')

  return isId
    ? `Analisis trade ini SECARA MENDALAM. Jangan memberikan jawaban generik.

**Trade yang Dianalisis:**
- Pair: ${trade.symbol} | Tipe: ${trade.type}
- Entry: $${trade.open_price || 'N/A'} → Exit: $${trade.close_price || 'N/A'}
- Lot: ${trade.lot_size || 'N/A'} | P/L: $${trade.profit_loss?.toFixed(2) || 0}
- Sesi: ${trade.session || 'N/A'} | Catatan: "${trade.notes || '-'}"

**Konteks — Statistik Keseluruhan:**
- Win Rate: ${stats.winRate?.toFixed(1) || 0}% | Total P/L: $${stats.totalPL?.toFixed(2) || 0} | ${stats.totalTrades || 0} trades

**Konteks — ${recent.length} Trade Terakhir:**
${recentTradesList}

**Pola yang Terdeteksi:**
- Win streak terbaik: ${winStreaks.bestWin} | Loss streak terburuk: ${winStreaks.worstLoss}
- Win rate pair ${trade.symbol}: ${symbolStats.winRate}% (${symbolStats.wins}/${symbolStats.total} trades)
- Sesi paling menguntungkan: ${sessionStats.best}
- Sesi paling merugi: ${sessionStats.worst}

Berdasarkan SEMUA data di atas, jawab:
1. Evaluasi keputusan entry/exit pada trade ini — APA yang salah/benar?
2. Apakah trade ini mengikuti pola positif atau negatif dari trade sebelumnya?
3. Jika trade ini loss: apa root cause-nya? Jika profit: apa yang membuatnya berhasil?
4. Saran SPESIFIK untuk trade ${trade.symbol} ${trade.type} selanjutnya`
    : `Analyze this trade IN DEPTH. Do NOT give a generic answer.

**Analyzed Trade:**
- Pair: ${trade.symbol} | Type: ${trade.type}
- Entry: $${trade.open_price || 'N/A'} → Exit: $${trade.close_price || 'N/A'}
- Lot: ${trade.lot_size || 'N/A'} | P/L: $${trade.profit_loss?.toFixed(2) || 0}
- Session: ${trade.session || 'N/A'} | Notes: "${trade.notes || '-'}"

**Context — Overall Stats:**
- Win Rate: ${stats.winRate?.toFixed(1) || 0}% | Total P/L: $${stats.totalPL?.toFixed(2) || 0} | ${stats.totalTrades || 0} trades

**Context — Last ${recent.length} Trades:**
${recentTradesListEn}

**Detected Patterns:**
- Best win streak: ${winStreaks.bestWin} | Worst loss streak: ${winStreaks.worstLoss}
- ${trade.symbol} win rate: ${symbolStats.winRate}% (${symbolStats.wins}/${symbolStats.total} trades)
- Most profitable session: ${sessionStats.best}
- Least profitable session: ${sessionStats.worst}

Based on ALL data above, answer:
1. Evaluate entry/exit decisions on this trade — WHAT was right/wrong?
2. Does this trade follow a positive or negative pattern from previous trades?
3. If loss: what's the root cause? If profit: what made it work?
4. SPECIFIC advice for the next ${trade.symbol} ${trade.type} trade`
}

// ==================== DATA ANALYSIS HELPERS ====================

function calculateStreaks(trades: any[]): { bestWin: number; worstLoss: number } {
  let bestWin = 0, worstLoss = 0, current = 0, isWin = false
  for (const t of trades) {
    const won = (t.profit_loss || 0) > 0
    if (won) {
      current = isWin ? current + 1 : 1
      isWin = true
      bestWin = Math.max(bestWin, current)
    } else {
      current = !isWin ? current + 1 : 1
      isWin = false
      worstLoss = Math.max(worstLoss, current)
    }
  }
  return { bestWin, worstLoss }
}

function getSymbolStats(trades: any[], symbol: string): { wins: number; total: number; winRate: string } {
  const relevant = trades.filter(t => t.symbol === symbol)
  if (relevant.length === 0) return { wins: 0, total: 0, winRate: '0' }
  const wins = relevant.filter(t => (t.profit_loss || 0) > 0).length
  return { wins, total: relevant.length, winRate: ((wins / relevant.length) * 100).toFixed(0) }
}

function getSessionStats(trades: any[]): { best: string; worst: string } {
  const bySession: Record<string, number> = {}
  for (const t of trades) {
    const s = t.session || 'Unknown'
    bySession[s] = (bySession[s] || 0) + (t.profit_loss || 0)
  }
  const entries = Object.entries(bySession).sort((a, b) => b[1] - a[1])
  return {
    best: entries.length > 0 ? `${entries[0][0]} ($${entries[0][1].toFixed(0)})` : 'No data',
    worst: entries.length > 1 ? `${entries[entries.length - 1][0]} ($${entries[entries.length - 1][1].toFixed(0)})` : 'No data'
  }
}

function getMarketInsightPrompt(lang: 'id' | 'en'): string {
  const now = new Date()
  const hourWIB = (now.getUTCHours() + 7) % 24 // WIB = UTC+7
  const dayName = now.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' })
  const isId = lang === 'id'

  let activeSession = ''
  let nextSession = ''
  if (hourWIB >= 0 && hourWIB < 8) {
    activeSession = 'Asia (00:00-08:00 WIB)'
    nextSession = 'London buka pukul 14:00 WIB'
  } else if (hourWIB >= 8 && hourWIB < 14) {
    activeSession = 'Transition Asia→London (08:00-14:00 WIB)'
    nextSession = 'London overlap pukul 14:00 WIB'
  } else if (hourWIB >= 14 && hourWIB < 19) {
    activeSession = 'London (14:00-23:00 WIB) - SESI PALING VOLATILE'
    nextSession = 'New York overlap pukul 19:00 WIB'
  } else if (hourWIB >= 19 && hourWIB < 23) {
    activeSession = 'London+New York Overlap (19:00-23:00 WIB) - VOLUME TERTINGGI'
    nextSession = 'New York saja hingga 04:00 WIB'
  } else {
    activeSession = 'New York (23:00-04:00 WIB)'
    nextSession = 'Sesi Asia dimulai pukul 00:00 WIB'
  }

  return isId
    ? `Hari ini ${dayName}, jam ${hourWIB.toString().padStart(2, '0')}:00 WIB.

Sesi aktif sekarang: **${activeSession}**
Sesi berikutnya: ${nextSession}

Buatkan insight pasar hari ini yang SPESIFIK untuk kondisi sekarang:
1. Analisis volatilitas yang diharapkan di sesi ${activeSession}
2. Pair mana yang paling aktif di sesi ini? (berdasarkan karakteristik sesi)
3. Setup atau pola teknikal apa yang biasanya muncul di sesi dan hari ini?
4. Risk management spesifik untuk sesi ini (misal: max spread, waktu entry optimal)
5. Event ekonomi apa yang perlu diwaspadai hari ini?

JANGAN berikan jawaban generik tentang "selalu gunakan stop loss". Saya sudah tahu itu.
Beri insight yang BERBEDA setiap kali dan sesuai dengan sesi saat ini.`
    : `Today is ${dayName}, ${hourWIB.toString().padStart(2, '0')}:00 WIB.

Active session: **${activeSession}**
Next session: ${nextSession}

Create SPECIFIC market insights for current conditions:
1. Expected volatility in ${activeSession}
2. Which pairs are most active in this session? (based on session characteristics)
3. What technical setups/patterns typically appear in this session and day?
4. Session-specific risk management (e.g., max spread, optimal entry timing)
5. What economic events to watch today?

Do NOT give generic advice like "always use stop loss". I already know that.
Provide UNIQUE insights each time, relevant to the current session.`
}

function buildChatPrompt(lang: 'id' | 'en', message: string, context: Record<string, any>): string {
  const trades = context.trades || []
  const analytics = context.analytics || {}
  const isId = lang === 'id'

  // Build rich context
  const tradesBlock = trades.length > 0
    ? trades.slice(0, 15).map((t: any) => `${t.symbol} ${t.type} | $${t.profit_loss?.toFixed(2)} | Sesi: ${t.session || '-'} | ${t.notes?.substring(0, 60) || '-'}`).join('\n')
    : 'Belum ada data trade.'

  const statsBlock = analytics.totalTrades
    ? `Win Rate: ${analytics.winRate?.toFixed(1)}% | Total P/L: $${analytics.totalPL?.toFixed(2)} | PF: ${analytics.profitFactor?.toFixed(2)} | ${analytics.totalTrades} trades | Max DD: $${analytics.maxDrawdown?.toFixed(2)}`
    : 'Statistik belum tersedia.'

  const sessions = analytics.sessionPerformance || []
  const sessionsBlock = sessions.length > 0
    ? sessions.map((s: any) => `${s.session}: P/L $${s.pl?.toFixed(0)}, ${s.trades} trades, WR ${s.winRate?.toFixed(0)}%`).join(' | ')
    : ''

  const sessionsBlockLine = sessionsBlock ? `\n**Per Sesi:** ${sessionsBlock}` : ''
  const sessionsBlockLineEn = sessionsBlock ? `\n**Per Session:** ${sessionsBlock}` : ''

  return isId
    ? `Pertanyaan: "${message}"

**Data Trading User (15 trade terakhir):**
${tradesBlock}

**Statistik:** ${statsBlock}
${sessionsBlockLine}

Jawab pertanyaan user dengan menggunakan data di atas. Jadilah spesifik dan personal. Jika user bertanya sesuatu yang tidak terkait data, jawab dengan sopan tapi arahkan kembali ke topik trading.`
    : `Question: "${message}"

**User's Trading Data (last 15 trades):**
${tradesBlock}

**Stats:** ${statsBlock}
${sessionsBlockLineEn}

Answer the user's question using the data above. Be specific and personal. If the user asks something unrelated to their data, answer politely but redirect to trading topics.`
}

// ==================== DATA-DRIVEN FALLBACK (NO TEMPLATES) ====================

function buildSmartPerformanceFallback(data: Record<string, any>, lang: 'id' | 'en'): string {
  const d = data
  const isId = lang === 'id'
  const { totalTrades = 0, winRate = 0, totalPL = 0, avgProfit = 0, avgLoss = 0, profitFactor = 0, maxDrawdown = 0, sharpeRatio = 0 } = d
  const sessions = d.sessionPerformance || []
  const monthly = d.monthlyPerformance || []

  // Build analysis
  const lines: string[] = []

  // 1. Main diagnosis
  const rr = (avgLoss > 0 && avgProfit > 0) ? (avgProfit / Math.abs(avgLoss)) : 0
  const ev = winRate > 0 ? (winRate / 100 * avgProfit) - ((1 - winRate / 100) * Math.abs(avgLoss)) : 0

  if (winRate < 45) {
    lines.push(isId ? '🔍 **Diagnosis Utama: Entry Quality Rendah**' : '🔍 **Main Diagnosis: Low Entry Quality**')
    lines.push(isId
      ? `Win rate ${winRate.toFixed(1)}% menunjukkan bahwa sebagian besar entry Anda tidak tepat. Dengan ${totalTrades} trades, ini bukan kebetulan — ada masalah sistematis di cara Anda memilih setup.`
      : `A ${winRate.toFixed(1)}% win rate across ${totalTrades} trades shows most entries are poorly timed. This isn't bad luck — there's a systematic issue with your setup selection.`)
  } else if (rr < 1) {
    lines.push(isId ? '🔍 **Diagnosis Utama: Risk-Reward Terbalik**' : '🔍 **Main Diagnosis: Inverted Risk-Reward**')
    lines.push(isId
      ? `Win rate ${winRate.toFixed(1)}% sebenarnya oke, TAPI rata-rata profit ($${avgProfit.toFixed(2)}) lebih kecil dari rata-rata loss ($${Math.abs(avgLoss).toFixed(2)}). Ini berarti 1 loss menghapus beberapa win. Anda perlu memperbesar target profit atau memperkecil stop loss.`
      : `${winRate.toFixed(1)}% win rate is actually decent, BUT your average profit ($${avgProfit.toFixed(2)}) is smaller than your average loss ($${Math.abs(avgLoss).toFixed(2)}). One loss wipes out several wins. You need to increase profit targets or tighten stops.`)
  } else if (maxDrawdown > totalPL * 0.5 && totalPL > 0) {
    lines.push(isId ? '🔍 **Diagnosis Utama: Drawdown Terlalu Besar**' : '🔍 **Main Diagnosis: Excessive Drawdown**')
    lines.push(isId
      ? `Anda profitable ($${totalPL.toFixed(2)}), tapi max drawdown $${maxDrawdown.toFixed(2)} mencapai ${((maxDrawdown / (totalPL + maxDrawdown)) * 100).toFixed(0)}% dari equity peak. Ini berisiko — satu drawdown besar bisa menghapus semua profit.`
      : `You're profitable ($${totalPL.toFixed(2)}), but max drawdown of $${maxDrawdown.toFixed(2)} is ${((maxDrawdown / (totalPL + maxDrawdown)) * 100).toFixed(0)}% of equity peak. This is risky — one bad streak could wipe all profits.`)
  } else if (totalPL > 0 && ev > 0) {
    lines.push(isId ? '🔍 **Diagnosis: Strategi Profitable dengan Edge Positif**' : '🔍 **Diagnosis: Profitable Strategy with Positive Edge**')
    lines.push(isId
      ? `Expected value per trade: +$${ev.toFixed(2)}. Ini berarti setiap trade secara rata-rata menghasilkan profit. Tugas Anda sekarang adalah SCALING — pertahankan kualitas setup dan tingkatkan quantity secara bertahap.`
      : `Expected value per trade: +$${ev.toFixed(2)}. This means each trade is profitable on average. Your task now is SCALING — maintain setup quality and gradually increase quantity.`)
  } else {
    lines.push(isId ? '🔍 **Diagnosis: Perlu Perbaikan Menyeluruh**' : '🔍 **Diagnosis: Needs Overall Improvement**')
    lines.push(isId
      ? `Dengan EV per trade $${ev.toFixed(2)}, setiap trade rata-rata ${ev >= 0 ? 'break-even' : 'merugikan'}. Fokus pada membangun edge yang konsisten sebelum menambah volume.`
      : `With an EV of $${ev.toFixed(2)} per trade, each trade is ${ev >= 0 ? 'break-even' : 'losing money on average'}. Focus on building a consistent edge before increasing volume.`)
  }

  // 2. Session-specific advice
  if (sessions.length >= 2) {
    const sorted = [...sessions].sort((a: any, b: any) => b.pl - a.pl)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    lines.push('')
    lines.push(isId
      ? `📊 **Rekomendasi Sesi:**
• Fokus di **${best.session}** — profit $${best.pl.toFixed(0)} dari ${best.trades} trades (WR ${best.winRate.toFixed(0)}%)
• Kurangi/stop trading di **${worst.session}** — loss $${worst.pl.toFixed(0)} dari ${worst.trades} trades`
      : `📊 **Session Recommendation:**
• Focus on **${best.session}** — $${best.pl.toFixed(0)} profit from ${best.trades} trades (WR ${best.winRate.toFixed(0)}%)
• Reduce/stop trading **${worst.session}** — $${worst.pl.toFixed(0)} loss from ${worst.trades} trades`)
  }

  // 3. Monthly trend
  if (monthly.length >= 3) {
    const last3 = monthly.slice(-3)
    const improving = last3[2].pl > last3[0].pl
    // Extract .map() into variable to avoid nested template literals
    const trendStrId = last3.map(m => `${m.month}: $${m.pl.toFixed(0)}`).join(' → ')
    const trendStrEn = last3.map(m => `${m.month}: $${m.pl.toFixed(0)}`).join(' → ')
    lines.push('')
    lines.push(isId
      ? `📈 **Tren 3 Bulan Terakhir:** ${improving ? '↗️ Membaik' : '↘️ Memburuk'} (${trendStrId})`
      : `📈 **Last 3 Months:** ${improving ? '↗️ Improving' : '↘️ Declining'} (${trendStrEn})`)
  }

  // 4. Concrete actions
  lines.push('')
  lines.push(isId ? '✅ **3 Langkah Concrete:**' : '✅ **3 Concrete Steps:**')
  if (rr < 1.5) {
    lines.push(isId
      ? `1. **Perbaiki Risk:Reward** — Saat ini ${rr.toFixed(1)}:1. Target minimal 2:1. Artinya jika SL 20 pips, TP harus 40+ pips.
2. **Gunakan Trailing Stop** — Untuk mengunci profit dan memperbesar R:R secara alami.
3. **Catat alasan entry di setiap trade** — Ini membantu identifikasi setup mana yang R:R tinggi.`
      : `1. **Fix Risk:Reward** — Currently ${rr.toFixed(1)}:1. Target minimum 2:1. If SL is 20 pips, TP should be 40+.
2. **Use Trailing Stops** — To lock in profits and naturally increase R:R.
3. **Log entry reasons for every trade** — This helps identify which setups have high R:R.`)
  } else if (winRate < 50) {
    lines.push(isId
      ? `1. **Tingkatkan Filter Entry** — Hanya trade setup yang sudah teruji. Jangan FOMO entry.
2. **Multi-timeframe Confirmation** — Gunakan D1 untuk trend, H4 untuk level, H1 untuk entry.
3. **Buat Checklist Entry** — Tulis 3-5 kriteria yang HARUS terpenuhi sebelum entry. Jika 1 tidak ada, skip.`
      : `1. **Tighten Entry Filter** — Only trade proven setups. No FOMO entries.
2. **Multi-timeframe Confirmation** — Use D1 for trend, H4 for levels, H1 for entry.
3. **Create Entry Checklist** — Write 3-5 criteria that MUST be met before entry. If 1 is missing, skip.`)
  } else {
    lines.push(isId
      ? `1. **Tetapkan Target Harian** — Berdasarkan EV Anda ($${ev.toFixed(2)}/trade), target 2-3 trade berkualitas per hari.
2. **Scaling Plan** — Jika konsisten profitable 3 bulan, pertimbangkan naikkan lot size 10-20%.
3. **Review Mingguan** — Setiap Minggu, review semua trade. Catat pola yang mengulang dan perbaiki.`
      : `1. **Set Daily Targets** — Based on your EV ($${ev.toFixed(2)}/trade), target 2-3 quality trades per day.
2. **Scaling Plan** — If consistently profitable for 3 months, consider increasing lot size 10-20%.
3. **Weekly Review** — Every Sunday, review all trades. Note recurring patterns and improve.`)
  }

  return lines.join('\n\n')
}

function buildSmartTradeFallback(trade: any, lang: 'id' | 'en'): string {
  const pl = trade.profit_loss ? parseFloat(String(trade.profit_loss)) : 0
  const recent = trade._recentTrades || []
  const stats = trade._analytics || {}
  const isId = lang === 'id'
  const lines: string[] = []

  // Calculate pips if possible
  const entry = parseFloat(trade.open_price || trade.entry_price || 0)
  const exit = parseFloat(trade.close_price || trade.exit_price || 0)
  const pips = Math.abs(exit - entry) * (trade.symbol?.includes('JPY') ? 100 : 10000)

  // Recent context
  const last5 = recent.slice(0, 5)
  const recentWins = last5.filter(t => (t.profit_loss || 0) > 0).length
  const isOnStreak = recentWins >= 3 || recentWins === 0

  if (pl > 0) {
    lines.push(isId ? '✅ **Trade Profitable**' : '✅ **Profitable Trade**')
    lines.push(isId
      ? `${trade.symbol} ${trade.type} menghasilkan +$${pl.toFixed(2)} (${pips.toFixed(0)} pips). Entry $${entry} → Exit $${exit} pada sesi ${trade.session || '-'}.`
      : `${trade.symbol} ${trade.type} yielded +$${pl.toFixed(2)} (${pips.toFixed(0)} pips). Entry $${entry} → Exit $${exit} during ${trade.session || '-'} session.`)
    
    // Contextual analysis
    if (recent.length > 2) {
      const winRate = ((recentWins / last5.length) * 100).toFixed(0)
      lines.push(isId
        ? `\n📊 **Konteks:** Dari 5 trade terakhir, ${recentWins} dari ${last5.length} profit (WR ${winRate}%).${recentWins >= 4 ? ' Anda sedang dalam performa yang sangat baik!' : recentWins >= 2 ? ' Performa cukup konsisten.' : ' Performa masih volatile.'}`
        : `\n📊 **Context:** From the last 5 trades, ${recentWins} of ${last5.length} were profitable (WR ${winRate}%).${recentWins >= 4 ? ' You are performing very well!' : recentWins >= 2 ? ' Performance is fairly consistent.' : ' Performance is still volatile.'}`)
    }

    if (trade.notes) {
      lines.push(isId
        ? `\n📝 **Catatan Anda:** "${trade.notes}" — Pertahankan catatan seperti ini untuk pola yang bisa diulang.`
        : `\n📝 **Your Notes:** "${trade.notes}" — Keep notes like this for repeatable patterns.`)
    }

    lines.push(isId
      ? `\n💡 **Untuk trade ${trade.symbol} selanjutnya:** Perhatikan apakah kondisi market (sesi, volatilitas, trend) serupa dengan trade ini sebelum entry. Jika ya, setup yang sama bisa diulang.`
      : `\n💡 **For next ${trade.symbol} trade:** Check if market conditions (session, volatility, trend) are similar to this trade before entering. If yes, the same setup can be repeated.`)
  } else {
    lines.push(isId ? '❌ **Trade Merugi**' : '❌ **Losing Trade**')
    lines.push(isId
      ? `${trade.symbol} ${trade.type} loss -$${Math.abs(pl).toFixed(2)} (${pips.toFixed(0)} pips). Entry $${entry} → Exit $${exit} pada sesi ${trade.session || '-'}.`
      : `${trade.symbol} ${trade.type} lost -$${Math.abs(pl).toFixed(2)} (${pips.toFixed(0)} pips). Entry $${entry} → Exit $${exit} during ${trade.session || '-'} session.`)

    // Contextual loss analysis
    if (recent.length > 2) {
      const lossCount = last5.filter(t => (t.profit_loss || 0) < 0).length
      if (lossCount >= 3) {
        lines.push(isId
          ? `\n⚠️ **PERINGATAN:** ${lossCount} dari 5 trade terakhir loss! Ini menunjukkan kemungkinan:
1. Market condition tidak sesuai dengan strategi Anda
2. Anda sedang overtrading / revenge trading
3. Stop loss mungkin terlalu ketat

**Saran: BERHENTI trading hari ini.** Review ulang setup Anda besok dengan kepala yang jernih.`
          : `\n⚠️ **WARNING:** ${lossCount} of the last 5 trades lost! This likely means:
1. Market conditions don't match your strategy
2. You may be overtrading / revenge trading
3. Stop loss might be too tight

**Advice: STOP trading today.** Review your setups tomorrow with a clear head.`)
      } else {
        // Analyze if it's a normal loss or pattern
        const pairTrades = recent.filter(t => t.symbol === trade.symbol)
        if (pairTrades.length > 2) {
          const pairWR = ((pairTrades.filter(t => (t.profit_loss || 0) > 0).length / pairTrades.length) * 100).toFixed(0)
          // Extract pair WR suffix to avoid nested template literal
          const pairSuffixId = parseFloat(pairWR) < 40
            ? ` Pair ini bukan kekuatan Anda saat ini. Pertimbangkan untuk skip trade ${trade.symbol} sampai Anda menemukan setup yang lebih baik.`
            : ' Loss ini masih dalam range normal.'
          const pairSuffixEn = parseFloat(pairWR) < 40
            ? ` This pair isn't your strength right now. Consider skipping ${trade.symbol} trades until you find better setups.`
            : ' This loss is still within normal range.'
          lines.push(isId
            ? `\n📊 **Pola ${trade.symbol}:** Dari ${pairTrades.length} trade terakhir pada pair ini, WR ${pairWR}%.${pairSuffixId}`
            : `\n📊 **${trade.symbol} Pattern:** From ${pairTrades.length} recent trades on this pair, WR ${pairWR}%.${pairSuffixEn}`)
        }
      }
    }

    if (trade.notes) {
      lines.push(isId
        ? `\n📝 **Catatan Anda:** "${trade.notes}" — Gunakan catatan ini untuk belajar. Apakah ada pola di catatan trade yang loss vs profit?`
        : `\n📝 **Your Notes:** "${trade.notes}" — Use this to learn. Is there a pattern in notes between losing vs winning trades?`)
    }
  }

  return lines.join('\n\n')
}

function buildSmartMarketFallback(lang: 'id' | 'en'): string {
  const now = new Date()
  const hourWIB = (now.getUTCHours() + 7) % 24
  const dayName = now.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' })
  const isId = lang === 'id'
  const lines: string[] = []

  // Determine active session with real analysis
  let sessionName = ''
  let volatility = ''
  let bestPairs = ''
  let tips = ''

  if (hourWIB >= 14 && hourWIB < 23) {
    sessionName = 'London'
    volatility = isId ? 'TINGGI — Sesi London adalah sesi paling volatile untuk pair Eropa (EUR, GBP)' : 'HIGH — London session is the most volatile for European pairs (EUR, GBP)'
    bestPairs = isId
      ? 'EURUSD, GBPUSD, EURGBP, EURJPY — Pair Eropa paling aktif. USD pairs juga liquid di overlap dengan New York (19:00+ WIB).'
      : 'EURUSD, GBPUSD, EURGBP, EURJPY — European pairs most active. USD pairs also liquid during New York overlap (19:00+ WIB).'
    tips = isId
      ? `• Perhatikan data ekonomi EU/UK yang rilis sekitar 14:00-17:00 WIB — bisa bikin spike 50-100 pips
• Breakout strategy paling efektif di 15 menit pertama setelah London open (14:00 WIB)
• Jika tidak ada news besar, range trading di pair Eropa cenderung terjadi di tengah sesi`
      : `• Watch EU/UK economic data released around 14:00-17:00 WIB — can cause 50-100 pip spikes
• Breakout strategy most effective in the first 15 minutes after London open (14:00 WIB)
• If no major news, range trading on European pairs tends to occur mid-session`
  } else if (hourWIB >= 19 && hourWIB < 23) {
    sessionName = 'London + New York Overlap'
    volatility = isId ? 'SANGAT TINGGI — Volume tertinggi hari ini. Spread paling ketat, volatilitas paling tinggi.' : 'VERY HIGH — Highest volume of the day. Tightest spreads, highest volatility.'
    bestPairs = isId
      ? 'EURUSD, GBPUSD, USDJPY, USDCAD, AUDUSD — Semua major pair sangat aktif. Gold (XAUUSD) juga sangat volatile.'
      : 'EURUSD, GBPUSD, USDJPY, USDCAD, AUDUSD — All major pairs very active. Gold (XAUUSD) also highly volatile.'
    tips = isId
      ? `• Ini waktu terbaik untuk trading — likuiditas tinggi dan spread ketat
• NFP, FOMC, CPI biasanya rilis di sesi ini (19:30 atau 20:00 WIB) — CHECK CALENDER EKONOMI
• Hindari entry 15 menit sebelum dan sesudah news besar
• Trend yang terbentuk di overlap sering bertahan sampai sesi New York berakhir`
      : `• Best time to trade — high liquidity and tight spreads
• NFP, FOMC, CPI usually released in this session (19:30 or 20:00 WIB) — CHECK ECONOMIC CALENDAR
• Avoid entries 15 minutes before and after major news
• Trends formed during overlap often persist until NY session ends`
  } else if (hourWIB >= 0 && hourWIB < 8) {
    sessionName = 'Asia'
    volatility = isId ? 'RENDAH — Sesi Asia umumnya ranging. Spread bisa lebih lebar untuk non-USD pairs.' : 'LOW — Asian session is typically ranging. Spreads can be wider for non-USD pairs.'
    bestPairs = isId
      ? 'USDJPY, AUDUSD, NZDUSD, EURJPY — Pair Asia-Pasifik paling aktif. GBP dan EUR cenderung ranging.'
      : 'USDJPY, AUDUSD, NZDUSD, EURJPY — Asia-Pacific pairs most active. GBP and EUR tend to range.'
    tips = isId
      ? `• Sesi Asia bagus untuk: identifikasi range harian, breakout di London open (08:00 WIB ke 14:00 WIB)
• Jangan force trade di sesi ini jika tidak ada setup jelas — save capital untuk London
• Range yang terbentuk di Asia sering menjadi area support/resistance untuk breakout London
• News Jepang/Australia bisa bikin pergerakan signifikan di pair Yen/Aussie`
      : `• Asian session good for: identifying daily range, breakout trades at London open (08:00→14:00 WIB)
• Don't force trades in this session if no clear setup — save capital for London
• Ranges formed in Asia often become S/R zones for London breakout
• Japan/Australia news can cause significant moves in Yen/Aussie pairs`
  } else {
    sessionName = 'Transition/Overlap'
    volatility = isId ? 'MODERATE — Transisi antar sesi, volatilitas mulai meningkat.' : 'MODERATE — Transition between sessions, volatility picking up.'
    bestPairs = isId
      ? 'Pair yang relevan dengan sesi yang sedang aktif. Perhatikan perubahan volatilitas.'
      : 'Pairs relevant to the currently active session. Watch for volatility changes.'
    tips = isId
      ? `• Sesi transisi sering menghasilkan false breakout — tunggu konfirmasi
• Perhatikan candle H1 untuk konfirmasi arah sebelum entry
• Spread bisa melebar saat transisi sesi — hati-hati`
      : `• Session transitions often produce false breakouts — wait for confirmation
• Watch H1 candle for direction confirmation before entry
• Spreads can widen during session transitions — be careful`
  }

  const dayContext = (dayName === 'Senin' || dayName === 'Monday')
    ? (isId ? '\n📅 **Hari Senin:** Market sering bikin fake direction di awal sesi. Tunggu sampai London open untuk konfirmasi trend minggu ini.' : '\n📅 **Monday:** Market often makes false direction moves early. Wait for London open to confirm the weekly trend.')
    : (dayName === 'Jumat' || dayName === 'Friday')
    ? (isId ? '\n📅 **Hari Jumat:** Hati-hati setelah 20:00 WIB — liquiditas menurun drastis dan spread bisa melebar. Close posisi sebelum weekend.' : '\n📅 **Friday:** Be careful after 20:00 WIB — liquidity drops sharply and spreads can widen. Close positions before weekend.')
    : ''

  lines.push(isId
    ? `🌍 **Insight Pasar — ${dayName}, ${hourWIB.toString().padStart(2, '0')}:00 WIB**\n\nSesi aktif: **${sessionName}**\nVolatilitas: ${volatility}\n\n📈 **Pair Terbaik:** ${bestPairs}\n\n💡 **Tips Spesifik:**\n${tips}${dayContext}`
    : `🌍 **Market Insight — ${dayName}, ${hourWIB.toString().padStart(2, '0')}:00 WIB**\n\nActive session: **${sessionName}**\nVolatility: ${volatility}\n\n📈 **Best Pairs:** ${bestPairs}\n\n💡 **Specific Tips:**\n${tips}${dayContext}`)

  return lines.join('\n')
}

function buildSmartChatFallback(message: string, context: Record<string, any>, lang: 'id' | 'en'): string {
  const msg = message.toLowerCase()
  const analytics = context.analytics || {}
  const trades = context.trades || []
  const isId = lang === 'id'

  // Build a comprehensive data profile
  const totalTrades = analytics.totalTrades || trades.length
  const winRate = analytics.winRate || (trades.length > 0 ? ((trades.filter(t => (t.profit_loss || 0) > 0).length / trades.length) * 100) : 0)
  const totalPL = analytics.totalPL || trades.reduce((sum: number, t: any) => sum + (t.profit_loss || 0), 0)
  const sessions = analytics.sessionPerformance || []

  // Session analysis for any question about sessions
  if (msg.includes('sesi') || msg.includes('session') || msg.includes('waktu') || msg.includes('kapan') || msg.includes('when') || msg.includes('terbaik') || msg.includes('best')) {
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a: any, b: any) => b.pl - a.pl)
      const best = sorted[0]
      const worst = sorted[sorted.length - 1]
      const avgPL = (sessions.reduce((s: number, x: any) => s + x.pl, 0) / sessions.length).toFixed(0)
      const bestWR = ((best.trades > 0 ? best.pl / best.trades : 0)).toFixed(2)

      // Extract .map() into variable to avoid nested template literal inside outer template literal
      const sessionLinesId = sorted.map((s: any, i: number) => {
        const emoji = i === 0 ? '🏆' : i === sorted.length - 1 ? '🔻' : '📊'
        return `${emoji} **${s.session}**: $${s.pl.toFixed(0)} | ${s.trades} trades | WR ${s.winRate.toFixed(0)}% | Avg P/L $${s.pl > 0 ? '+' : ''}${(s.pl / s.trades).toFixed(2)}/trade`
      }).join('\n')
      const sessionLinesEn = sorted.map((s: any, i: number) => {
        const emoji = i === 0 ? '🏆' : i === sorted.length - 1 ? '🔻' : '📊'
        return `${emoji} **${s.session}**: $${s.pl.toFixed(0)} | ${s.trades} trades | WR ${s.winRate.toFixed(0)}% | Avg P/L $${s.pl > 0 ? '+' : ''}${(s.pl / s.trades).toFixed(2)}/trade`
      }).join('\n')

      // Extract recommendation into variable to avoid nested template literal
      const recId = best.pl > worst.pl * 2
        ? `Fokus trading di ${best.session}. Anda jauh lebih profitable di sesi ini. Pertimbangkan untuk skip ${worst.session} sama sekali.`
        : `Perbedaan antar sesi tidak terlalu besar. Fokus pada kualitas setup daripada memilih sesi.`
      const recEn = best.pl > worst.pl * 2
        ? `Focus on ${best.session}. You're significantly more profitable in this session. Consider skipping ${worst.session} entirely.`
        : `Session differences aren't dramatic. Focus on setup quality over session selection.`

      return isId
        ? `📊 **Analisis Sesi Trading Anda:**\n\nDari ${totalTrades} trades di ${sessions.length} sesi:\n\n${sessionLinesId}\n\n**Kesimpulan:**\n• Sesi terbaik: **${best.session}** — rata-rata +$${bestWR}/trade\n• Sesi terlemah: **${worst.session}** — total loss $${worst.pl.toFixed(0)}\n• Rata-rata P/L per sesi: $${avgPL}\n\n💡 **Rekomendasi:** ${recId}`
        : `📊 **Trading Session Analysis:**\n\nFrom ${totalTrades} trades across ${sessions.length} sessions:\n\n${sessionLinesEn}\n\n**Summary:**\n• Best session: **${best.session}** — average +$${bestWR}/trade\n• Weakest session: **${worst.session}** — total loss $${worst.pl.toFixed(0)}\n• Average P/L per session: $${avgPL}\n\n💡 **Recommendation:** ${recEn}`
    }
    return isId
      ? `📊 Belum ada data sesi trading. Tambahkan trades dengan catatan sesi (Asia, London, New York) untuk analisis.`
      : `📊 No session data yet. Add trades with session notes (Asia, London, New York) for analysis.`
  }

  // Symbol analysis
  if (msg.includes('pair') || msg.includes('symbol') || msg.includes('eur') || msg.includes('gbp') || msg.includes('usd') || msg.includes('jpy') || msg.includes('aud')) {
    if (trades.length > 0) {
      const bySymbol: Record<string, { pl: number; count: number; wins: number }> = {}
      for (const t of trades) {
        if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { pl: 0, count: 0, wins: 0 }
        bySymbol[t.symbol].pl += t.profit_loss || 0
        bySymbol[t.symbol].count++
        if ((t.profit_loss || 0) > 0) bySymbol[t.symbol].wins++
      }
      const sorted = Object.entries(bySymbol).sort((a, b) => b[1].pl - a[1].pl)

      // Extract .map() into variable to avoid nested template literal
      const pairLinesId = sorted.map(([sym, d], i) => {
        const emoji = i === 0 ? '🏆' : i === sorted.length - 1 ? '🔻' : '📊'
        const wr = ((d.wins / d.count) * 100).toFixed(0)
        return `${emoji} **${sym}**: $${d.pl.toFixed(0)} | ${d.count} trades | WR ${wr}% | Avg $${(d.pl / d.count).toFixed(2)}/trade`
      }).join('\n')
      const pairLinesEn = sorted.map(([sym, d], i) => {
        const emoji = i === 0 ? '🏆' : i === sorted.length - 1 ? '🔻' : '📊'
        const wr = ((d.wins / d.count) * 100).toFixed(0)
        return `${emoji} **${sym}**: $${d.pl.toFixed(0)} | ${d.count} trades | WR ${wr}% | Avg $${(d.pl / d.count).toFixed(2)}/trade`
      }).join('\n')

      // Extract tip into variable to avoid nested template literal
      const pairTipId = sorted[0] && sorted[0][1].pl > 0 && sorted.length > 1 && sorted[sorted.length - 1][1].pl < 0
        ? `💡 Anda paling profitable di **${sorted[0][0]}** dan paling merugi di **${sorted[sorted.length - 1][0]}**. Pertimbangkan untuk fokus pada pair yang menguntungkan.`
        : `💡 Identifikasi pair mana yang paling cocok dengan gaya trading Anda dan fokus di sana.`
      const pairTipEn = sorted[0] && sorted[0][1].pl > 0 && sorted.length > 1 && sorted[sorted.length - 1][1].pl < 0
        ? `💡 You're most profitable on **${sorted[0][0]}** and lose most on **${sorted[sorted.length - 1][0]}**. Consider focusing on profitable pairs.`
        : `💡 Identify which pairs suit your trading style best and focus there.`

      return isId
        ? `📊 **Performa per Pair:**\n\n${pairLinesId}\n\n${pairTipId}`
        : `📊 **Performance by Pair:**\n\n${pairLinesEn}\n\n${pairTipEn}`
    }
    return isId ? '📊 Belum ada data trade. Mulai catat trading Anda!' : '📊 No trade data yet. Start logging your trades!'
  }

  // Psychology / emotion questions
  if (msg.includes('emosi') || msg.includes('psychology') || msg.includes('mental') || msg.includes('fear') || msg.includes('takut') || msg.includes('greed') || msg.includes('serakah') || msg.includes('marah') || msg.includes('revenge')) {
    const recentLosses = trades.slice(0, 10).filter(t => (t.profit_loss || 0) < 0).length
    const recentWins = trades.slice(0, 10).filter(t => (t.profit_loss || 0) > 0).length
    return isId
      ? `🧠 **Psikologi Trading Anda:**\n\nDari 10 trade terakhir: ${recentWins} profit, ${recentLosses} loss.\n\n${recentLosses > recentWins
        ? `⚠️ Anda sedang dalam negative streak (${recentLosses} loss dari 10 trade terakhir). Ini bisa memicu:
- **Revenge trading** — entry berulang untuk "balik modal"
- **Overtrading** — membuka posisi terlalu banyak
- **Fear of missing out (FOMO)** — entry tanpa setup valid\n\n**Langkah DARURAT:**\n1. STOP trading untuk hari ini\n2. Close semua posisi yang floating\n3. Review jurnal — identifikasi apa yang berubah dari ketika Anda profitable\n4. Besok, mulai dengan 1 trade saja dengan lot size kecil`
        : recentWins > recentLosses
          ? `✅ Performa psikologis baik — ${recentWins} dari 10 trade terakhir profit.\n\nTetap waspada terhadap:
- **Overconfidence** — jangan langsung naikkan lot size setelah win streak\n- **Euphoria** — tetap ikuti trading plan, jangan deviasi\n- **FOMO** — jangan entry di setup yang bukan milik Anda hanya karena market bergerak\n\n**Tips:** Journal emosi Anda setiap trade. Setelah 2 minggu, review pola emosi vs hasil trade.`
          : `📊 Data Anda balanced (${recentWins}W / ${recentLosses}L). Ini sebenarnya kondisi yang baik.\n\nTetap jaga:
- Jangan biarkan 1 loss besar mengganggu decision-making\n- Set daily loss limit (misal: max 3 loss)\n- Trading plan > emosi — kalau tidak yakin, jangan entry\n\n**Tips:** Catat level kepercayaan diri (1-10) di setiap trade. Ini membantu deteksi pola emosi.`
      }`
      : `🧠 **Trading Psychology:**\n\nFrom last 10 trades: ${recentWins} profits, ${recentLosses} losses.\n\n${recentLosses > recentWins
        ? `⚠️ You're in a negative streak (${recentLosses} losses from last 10 trades). This can trigger:
- **Revenge trading** — repeated entries to "win back"
- **Overtrading** — opening too many positions
- **FOMO** — entering without a valid setup\n\n**URGENT Steps:**\n1. STOP trading for today\n2. Close all floating positions\n3. Review your journal — identify what changed from when you were profitable\n4. Tomorrow, start with just 1 trade with small lot size`
        : recentWins > recentLosses
          ? `✅ Good psychological state — ${recentWins} of last 10 trades profitable.\n\nStay alert for:
- **Overconfidence** — don't increase lot size right after a win streak\n- **Euphoria** — keep following your trading plan, don't deviate\n- **FOMO** — don't enter non-your setups just because the market is moving\n\n**Tip:** Journal your emotions for each trade. After 2 weeks, review emotion patterns vs trade results.`
          : `📊 Your data is balanced (${recentWins}W / ${recentLosses}L). This is actually a good state.\n\nStay mindful of:
- Don't let 1 big loss affect decision-making\n- Set daily loss limit (e.g., max 3 losses)\n- Trading plan > emotions — if unsure, don't enter\n\n**Tip:** Rate your confidence level (1-10) on each trade. This helps detect emotion patterns.`
      }`
  }

  // General performance summary for anything else
  if (msg.includes('performa') || msg.includes('performance') || msg.includes('profit') || msg.includes('hasil') || msg.includes('summary') || msg.includes('ringkasan') || msg.includes('statistik') || msg.includes('statistics')) {
    const avgPL = totalTrades > 0 ? (totalPL / totalTrades).toFixed(2) : '0'
    const pf = analytics.profitFactor || 0
    const dd = analytics.maxDrawdown || 0
    const monthly = analytics.monthlyPerformance || []
    const lastMonth = monthly.length > 0 ? monthly[monthly.length - 1] : null

    // Extract nested template literals into variables
    const lastMonthLineId = lastMonth
      ? `\n**Bulan Ini (${lastMonth.month}):**\n• P/L: $${lastMonth.pl.toFixed(0)} | ${lastMonth.trades} trades\n• Avg per trade: $${(lastMonth.pl / lastMonth.trades).toFixed(2)}`
      : ''
    const lastMonthLineEn = lastMonth
      ? `\n**This Month (${lastMonth.month}):**\n• P/L: $${lastMonth.pl.toFixed(0)} | ${lastMonth.trades} trades\n• Avg per trade: $${(lastMonth.pl / lastMonth.trades).toFixed(2)}`
      : ''
    const assessmentId = totalPL > 0 && pf > 1.5
      ? '✅ Strategi Anda profitable dengan edge yang jelas. Fokus pada konsistensi dan scaling.'
      : totalPL > 0
        ? '⚠️ Profitable tapi edge tipis (PF < 1.5). Satu drawdown besar bisa menghapus profit. Perkuat risk management.'
        : '❌ Belum profitable. Tidak perlu banyak trade — fokus pada kualitas. Temukan 1-2 setup yang konsisten profit, lalu ulangi.'
    const assessmentEn = totalPL > 0 && pf > 1.5
      ? '✅ Your strategy is profitable with a clear edge. Focus on consistency and scaling.'
      : totalPL > 0
        ? '⚠️ Profitable but thin edge (PF < 1.5). One bad drawdown could wipe profits. Strengthen risk management.'
        : '❌ Not yet profitable. You don\'t need more trades — focus on quality. Find 1-2 setups that consistently profit, then repeat.'

    return isId
      ? `📊 **Ringkasan Performa Lengkap:**\n\n**Angka Utama:**\n• Total Trades: ${totalTrades} | Win Rate: ${winRate.toFixed(1)}%\n• Total P/L: **$${totalPL.toFixed(2)}** ${totalPL > 0 ? '✅' : '❌'}\n• Rata-rata per Trade: **$${avgPL}**\n• Profit Factor: ${pf.toFixed(2)} | Max Drawdown: $${dd.toFixed(0)}\n${lastMonthLineId}\n\n**Assessment:**\n${assessmentId}`
      : `📊 **Full Performance Summary:**\n\n**Key Numbers:**\n• Total Trades: ${totalTrades} | Win Rate: ${winRate.toFixed(1)}%\n• Total P/L: **$${totalPL.toFixed(2)}** ${totalPL > 0 ? '✅' : '❌'}\n• Average per Trade: **$${avgPL}**\n• Profit Factor: ${pf.toFixed(2)} | Max Drawdown: $${dd.toFixed(0)}\n${lastMonthLineEn}\n\n**Assessment:**\n${assessmentEn}`
  }

  // Default: intelligent response using available data
  const recentTradesSummary = trades.slice(0, 5).map(t => `${t.symbol} ${t.type}: $${(t.profit_loss || 0) > 0 ? '+' : ''}${(t.profit_loss || 0).toFixed(2)}`).join(', ')
  return isId
    ? `🤖 Saya bisa membantu analisis trading Anda! Data yang saya milik:\n\n📊 ${totalTrades} trades | WR ${winRate.toFixed(1)}% | P/L $${totalPL.toFixed(2)}\n📝 Trade terakhir: ${recentTradesSummary || 'Belum ada'}\n\nTanyakan sesuatu yang spesifik, misalnya:\n• "Analisis sesi terbaik saya" — saya akan breakdown performa per sesi\n• "Pair apa yang paling profitable?" — analisis per symbol\n• "Bagaimana psikologi trading saya?" — cek pola emosi dari data\n• "Tips risk management" — saran berdasarkan data Anda`
    : `🤖 I can help analyze your trading! Here's what I have:\n\n📊 ${totalTrades} trades | WR ${winRate.toFixed(1)}% | P/L $${totalPL.toFixed(2)}\n📝 Recent trades: ${recentTradesSummary || 'None yet'}\n\nAsk something specific, like:\n• "Analyze my best session" — I'll breakdown performance per session\n• "Most profitable pair?" — analysis by symbol\n• "How's my trading psychology?" — check emotion patterns from data\n• "Risk management tips" — advice based on your data`
}

// ==================== MAIN API HANDLER ====================

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireAuth(request)
    if (authError) return authError

    const pro = await isUserPro(user!.id)
    if (!pro) {
      return NextResponse.json({
        error: 'AI Insights adalah fitur PRO. Upgrade ke PRO untuk menggunakan AI trading assistant!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
    }

    if (!checkAIRateLimit(user!.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { type, data, language } = body
    const lang: 'id' | 'en' = (language === 'en') ? 'en' : 'id'

    let zaiResponse: string | null = null

    switch (type) {
      case 'trade_analysis': {
        const trade = data || {}
        zaiResponse = await askZAI(getSystemPrompt(lang), buildTradeAnalysisPrompt(lang, trade))
        if (!zaiResponse) zaiResponse = buildSmartTradeFallback(trade, lang)
        return NextResponse.json({ insight: zaiResponse })
      }

      case 'performance_tips': {
        zaiResponse = await askZAI(getSystemPrompt(lang), buildPerformancePrompt(lang, data))
        if (!zaiResponse) zaiResponse = buildSmartPerformanceFallback(data, lang)
        return NextResponse.json({ insight: zaiResponse })
      }

      case 'market_insight': {
        zaiResponse = await askZAI(getSystemPrompt(lang), getMarketInsightPrompt(lang))
        if (!zaiResponse) zaiResponse = buildSmartMarketFallback(lang)
        return NextResponse.json({ insight: zaiResponse })
      }

      case 'chart_analysis': {
        if (!data?.imageData) {
          return NextResponse.json({ error: 'No image data provided' }, { status: 400 })
        }
        const chartSystemPrompt = lang === 'id'
          ? 'Kamu adalah analis teknikal forex. Analisis chart trading yang diberikan. Jawab dalam Bahasa Indonesia. Identifikasi: 1) Trend yang sedang terjadi 2) Level support dan resistance yang terlihat 3) Pola chart (double top, head & shoulders, dll) 4) Indikator teknikal yang terlihat 5) Setup potensial dengan entry, SL, dan TP. JANGAN berikan rekomendasi untuk buy/sell spesifik. Jelaskan APA yang kamu lihat, bukan apa yang HARUS dilakukan.'
          : 'You are a forex technical analyst. Analyze the provided trading chart. Respond in English. Identify: 1) Current trend 2) Visible support and resistance levels 3) Chart patterns (double top, head & shoulders, etc.) 4) Visible technical indicators 5) Potential setups with entry, SL, and TP. Do NOT give specific buy/sell recommendations. Explain WHAT you see, not what to do.'
        zaiResponse = await askZAIVision(chartSystemPrompt, data.imageData)
        if (!zaiResponse) {
          zaiResponse = lang === 'id'
            ? '❌ Analisis chart memerlukan koneksi AI yang sedang tidak tersedia. Coba lagi dalam beberapa saat.'
            : '❌ Chart analysis requires AI connection that is currently unavailable. Try again in a moment.'
        }
        return NextResponse.json({ insight: zaiResponse })
      }

      case 'chat': {
        zaiResponse = await askZAI(getSystemPrompt(lang), buildChatPrompt(lang, data.message, data.context))
        if (!zaiResponse) zaiResponse = buildSmartChatFallback(data.message, data.context, lang)
        return NextResponse.json({ insight: zaiResponse })
      }

      default:
        return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 })
    }
  } catch (error) {
    console.error('[AI /insight] Error:', error)
    return NextResponse.json({
      error: 'Gagal generate insight. Coba lagi.',
      insight: null
    }, { status: 500 })
  }
}
