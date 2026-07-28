import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createZAI } from '@/lib/zai'
import { isUserPro } from '@/lib/pro-check'

// In-memory rate limiter
const aiRateLimit = new Map<string, { count: number; resetAt: number }>()
const AI_RATE_LIMIT = 20 // 20 requests per minute
const AI_RATE_WINDOW = 60 * 1000 // 1 minute

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

// ==================== LANGUAGE-AWARE ZAI HELPER ====================

async function askZAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const zai = await createZAI()
    const result = await zai.chat.completions.create({
      model: 'glm-4.6',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
    return result.choices?.[0]?.message?.content || ''
  } catch (error: any) {
    console.warn('[AI] ZAI failed, using fallback:', error.message)
    return null
  }
}

// ==================== SYSTEM PROMPTS (language-aware) ====================

function getSystemPrompt(lang: 'id' | 'en'): string {
  return lang === 'id'
    ? `Kamu adalah AI Trading Coach untuk LuxTrade, platform jurnal trading Indonesia. 
Kamu harus:
1. SELALU menjawab dalam Bahasa Indonesia yang natural dan profesional — bukan terjemahan kaku
2. Gunakan istilah trading yang familiar di Indonesia (lot, pips, stop loss, take profit, scalping, swing, dll)
3. Berikan saran yang actionable dan spesifik berdasarkan data trading user
4. Format jawaban dengan emoji dan markdown untuk readability
5. Jika data tidak cukup, katakan dengan jelas dan sarankan apa yang perlu dilakukan
6. Jangan pernah menyarankan untuk membeli/menjual pair tertentu secara spesifik`
    : `You are an AI Trading Coach for LuxTrade, a trading journal platform.
You should:
1. Always respond in English, professional but friendly
2. Use common trading terminology (lot, pips, stop loss, take profit, scalping, swing, etc.)
3. Provide actionable and specific advice based on the user's trading data
4. Format responses with emojis and markdown for readability
5. If data is insufficient, clearly say so and suggest what to do
6. Never recommend buying/selling specific pairs`
}

function getPerformancePrompt(lang: 'id' | 'en', data: Record<string, any>): string {
  const d = data
  if (lang === 'id') {
    return `Analisis performa trading saya dan berikan saran untuk memperbaiki:

**Data Trading:**
- Total Trades: ${d.totalTrades || 0}
- Win Rate: ${d.winRate?.toFixed(1) || 0}%
- Total Profit/Loss: $${d.totalPL?.toFixed(2) || 0}
- Average Profit: $${d.avgProfit?.toFixed(2) || 0}
- Average Loss: $${d.avgLoss?.toFixed(2) || 0}
- Profit Factor: ${d.profitFactor?.toFixed(2) || 0}
- Max Drawdown: $${d.maxDrawdown?.toFixed(2) || 0}
- Sharpe Ratio: ${d.sharpeRatio?.toFixed(2) || 0}
${d.sessionPerformance?.length ? `\n**Performa per Sesi:**\n${d.sessionPerformance.map((s: any) => `- ${s.session}: ${s.trades} trades, P/L $${s.pl?.toFixed(0) || 0}, WR ${s.winRate?.toFixed(0) || 0}%`).join('\n')}` : ''}
${d.monthlyPerformance?.length ? `\n**Performa Bulanan:**\n${d.monthlyPerformance.slice(-6).map((m: any) => `- ${m.month}: ${m.trades} trades, P/L $${m.pl?.toFixed(0) || 0}`).join('\n')}` : ''}

Berikan analisis mendalam dan 3-5 saran spesifik yang bisa saya lakukan untuk meningkatkan performa.`
  }
  return `Analyze my trading performance and provide improvement suggestions:

**Trading Data:**
- Total Trades: ${d.totalTrades || 0}
- Win Rate: ${d.winRate?.toFixed(1) || 0}%
- Total Profit/Loss: $${d.totalPL?.toFixed(2) || 0}
- Average Profit: $${d.avgProfit?.toFixed(2) || 0}
- Average Loss: $${d.avgLoss?.toFixed(2) || 0}
- Profit Factor: ${d.profitFactor?.toFixed(2) || 0}
- Max Drawdown: $${d.maxDrawdown?.toFixed(2) || 0}
- Sharpe Ratio: ${d.sharpeRatio?.toFixed(2) || 0}
${d.sessionPerformance?.length ? `\n**Session Performance:**\n${d.sessionPerformance.map((s: any) => `- ${s.session}: ${s.trades} trades, P/L $${s.pl?.toFixed(0) || 0}, WR ${s.winRate?.toFixed(0) || 0}%`).join('\n')}` : ''}
${d.monthlyPerformance?.length ? `\n**Monthly Performance:**\n${d.monthlyPerformance.slice(-6).map((m: any) => `- ${m.month}: ${m.trades} trades, P/L $${m.pl?.toFixed(0) || 0}`).join('\n')}` : ''}

Provide an in-depth analysis and 3-5 specific actionable suggestions to improve performance.`
}

function getTradeAnalysisPrompt(lang: 'id' | 'en', trade: any): string {
  const recentTrades = trade._recentTrades || []
  const analytics = trade._analytics || {}

  const recentTradesSummary = recentTrades.length > 1
    ? (lang === 'id'
        ? `\n\n**20 Trade Terakhir User:**\n${recentTrades.slice(0, 20).map((t: any) => `- ${t.symbol} ${t.type}: P/L $${t.profit_loss?.toFixed(2) || 'N/A'}, Sesi: ${t.session || '-'}${t.notes ? ', Catatan: ' + t.notes.substring(0, 60) : ''}`).join('\n')}`
        : `\n\n**User's Recent 20 Trades:**\n${recentTrades.slice(0, 20).map((t: any) => `- ${t.symbol} ${t.type}: P/L $${t.profit_loss?.toFixed(2) || 'N/A'}, Session: ${t.session || '-'}${t.notes ? ', Notes: ' + t.notes.substring(0, 60) : ''}`).join('\n')}`)
    : ''

  const analyticsSummary = analytics.totalTrades
    ? (lang === 'id'
        ? `\n**Statistik Keseluruhan:** Win Rate: ${analytics.winRate?.toFixed(1) || 0}%, Total P/L: $${analytics.totalPL?.toFixed(2) || 0}, ${analytics.totalTrades} trades`
        : `\n**Overall Stats:** Win Rate: ${analytics.winRate?.toFixed(1) || 0}%, Total P/L: $${analytics.totalPL?.toFixed(2) || 0}, ${analytics.totalTrades} trades`)
    : ''

  if (lang === 'id') {
    return `Analisis trade ini secara mendalam dan berikan saran berdasarkan pola trading keseluruhan:

**Detail Trade:**
- Pair: ${trade.symbol || 'N/A'}
- Tipe: ${trade.type || 'N/A'}
- Entry: $${trade.open_price || trade.entry_price || 'N/A'}
- Exit: $${trade.close_price || trade.exit_price || 'N/A'}
- Lot Size: ${trade.lot_size || trade.quantity || 'N/A'}
- Profit/Loss: $${trade.profit_loss?.toFixed(2) || 'N/A'}
- Sesi: ${trade.session || 'N/A'}
- Durasi: ${trade.trade_duration || 'N/A'}
- Catatan: ${trade.notes || 'Tidak ada catatan'}
- Strategy: ${trade.strategy || 'Tidak disebutkan'}
${recentTradesSummary}
${analyticsSummary}

Berikan analisis dalam Bahasa Indonesia:
1. Evaluasi trade ini (apakah decision-making bagus?)
2. Bandingkan dengan pola trade sebelumnya — ada pola berulang?
3. Apa yang bisa diperbaiki?
4. Saran spesifik untuk trade serupa di masa depan`
  }
  return `Analyze this trade in depth and provide suggestions based on overall trading patterns:

**Trade Details:**
- Pair: ${trade.symbol || 'N/A'}
- Type: ${trade.type || 'N/A'}
- Entry: $${trade.open_price || trade.entry_price || 'N/A'}
- Exit: $${trade.close_price || trade.exit_price || 'N/A'}
- Lot Size: ${trade.lot_size || trade.quantity || 'N/A'}
- Profit/Loss: $${trade.profit_loss?.toFixed(2) || 'N/A'}
- Session: ${trade.session || 'N/A'}
- Duration: ${trade.trade_duration || 'N/A'}
- Notes: ${trade.notes || 'No notes'}
- Strategy: ${trade.strategy || 'Not specified'}
${recentTradesSummary}
${analyticsSummary}

Provide:
1. Trade evaluation (was the decision-making sound?)
2. Compare with previous trades — are there recurring patterns?
3. What could be improved?
4. Specific suggestions for similar trades in the future`
}

function getMarketInsightPrompt(lang: 'id' | 'en'): string {
  return lang === 'id'
    ? `Berikan insight pasar hari ini untuk trader forex Indonesia. Include:
1. Analisis sesi trading (Asia, London, New York) dan rekomendasi pair terbaik per sesi
2. Tips risk management yang relevan untuk kondisi pasar saat ini
3. Tips psikologi trading untuk hari ini
4. 2-3 setup atau pola yang perlu diwaspadai

Jawab dalam Bahasa Indonesia yang natural.`
    : `Provide today's market insights for forex traders. Include:
1. Trading session analysis (Asia, London, New York) and recommended pairs per session
2. Relevant risk management tips for current market conditions
3. Trading psychology tips for today
4. 2-3 setups or patterns to watch

Respond in English.`
}

function getChatPrompt(lang: 'id' | 'en', message: string, context: Record<string, any>): string {
  const trades = context.trades || []
  const analytics = context.analytics || {}

  const tradesSummary = trades.length > 0
    ? `\n\n**Recent Trades:**\n${trades.slice(0, 10).map((t: any) => `- ${t.symbol} ${t.type}: P/L $${t.profit_loss?.toFixed(2) || 'N/A'}, Notes: ${t.notes?.substring(0, 50) || 'None'}`).join('\n')}`
    : ''

  const analyticsSummary = analytics.totalTrades
    ? `\n\n**Stats:** Win Rate: ${analytics.winRate?.toFixed(1) || 0}%, P/L: $${analytics.totalPL?.toFixed(2) || 0}, ${analytics.totalTrades || 0} trades`
    : ''

  return lang === 'id'
    ? `Pertanyaan user: "${message}"${tradesSummary}${analyticsSummary}\n\nJawab dalam Bahasa Indonesia. Gunakan data trading di atas untuk memberikan jawaban yang kontekstual dan personalized.`
    : `User question: "${message}"${tradesSummary}${analyticsSummary}\n\nRespond in English. Use the trading data above for contextual and personalized answers.`
}

// ==================== LOCAL FALLBACKS (Indonesian) ====================

function generatePerformanceTips(data: Record<string, any>, lang: 'id' | 'en'): string {
  const { totalTrades = 0, winRate = 0, totalPL = 0, avgProfit = 0, avgLoss = 0, profitFactor = 0, maxDrawdown = 0 } = data
  const tips: string[] = []

  if (lang === 'en') {
    if (winRate >= 70) tips.push(`🎯 Your win rate of ${winRate.toFixed(1)}% is excellent! Focus on risk management to stay consistent.`)
    else if (winRate >= 50) tips.push(`📈 Win rate ${winRate.toFixed(1)}% is decent. Improve entry timing to push above 60%.`)
    else if (winRate > 0) tips.push(`⚠️ Win rate ${winRate.toFixed(1)}% needs improvement. Try reducing overtrading and waiting for better setups.`)

    if (profitFactor >= 2) tips.push(`💰 Profit factor ${profitFactor.toFixed(2)} shows a strong edge. Keep this strategy!`)
    else if (profitFactor >= 1.5) tips.push(`📊 Profit factor ${profitFactor.toFixed(2)} - decent. Focus on cutting losers faster.`)
    else if (profitFactor > 0 && profitFactor < 1.5) tips.push(`🔴 Profit factor ${profitFactor.toFixed(2)} is below 1.5. Increase your risk-to-reward to at least 1:2.`)

    if (avgLoss > 0 && avgProfit > 0) {
      const rr = avgProfit / avgLoss
      if (rr >= 2) tips.push(`✅ Risk-to-reward ${rr.toFixed(1)}:1 is very healthy. This is key to long-term profitability.`)
      else if (rr >= 1) tips.push(`⚖️ R:R ratio ${rr.toFixed(1)}:1 can be improved. Target at least 2:1 per trade.`)
      else tips.push(`🔻 R:R ratio ${rr.toFixed(1)}:1 needs attention. Your average loss exceeds your profit!`)
    }

    if (maxDrawdown > 500) tips.push(`📉 Max drawdown $${maxDrawdown.toFixed(0)} is quite large. Consider reducing lot size.`)
    else if (maxDrawdown > 200) tips.push(`📉 Drawdown $${maxDrawdown.toFixed(0)} is normal, but set a daily stop loss to limit it.`)

    if (totalTrades > 50) tips.push(`🔁 With ${totalTrades} trades, your data is significant enough for analysis. Keep journaling!`)
    else if (totalTrades >= 10) tips.push(`📝 ${totalTrades} trades is enough to start seeing patterns. Add more data.`)
    else tips.push(`📊 At least 30 trades are needed for reliable statistics. Keep recording!`)

    if (totalPL > 0) tips.push(`💚 Total profit $${totalPL.toFixed(2)} - great job! Stay disciplined with your trading plan.`)
    else if (totalPL < 0) tips.push(`💔 Total loss $${Math.abs(totalPL).toFixed(2)}. Don't force trades. Focus on quality over quantity.`)

    const psychTips = [
      '🧠 Trading journaling isn\'t just about numbers. Record your emotions and market conditions too.',
      '💪 Discipline is more important than strategy. Follow your rules consistently.',
      '⏸️ After 3 consecutive losses, stop trading. Refresh your mind then review your setups.',
      '📋 Before every entry, use a checklist: valid setup? stop loss? risk < 2%? If YES, then enter.',
    ]
    tips.push(psychTips[Math.floor(Math.random() * psychTips.length)])
  } else {
    // Indonesian
    if (winRate >= 70) tips.push(`🎯 Win rate Anda ${winRate.toFixed(1)}% sangat baik! Fokus pada risk management agar konsisten.`)
    else if (winRate >= 50) tips.push(`📈 Win rate ${winRate.toFixed(1)}% sudah decent. Perbaiki entry timing untuk push ke atas 60%.`)
    else if (winRate > 0) tips.push(`⚠️ Win rate ${winRate.toFixed(1)}% perlu perbaikan. Coba kurangi overtrading dan tunggu setup yang lebih valid.`)

    if (profitFactor >= 2) tips.push(`💰 Profit factor ${profitFactor.toFixed(2)} menunjukkan edge yang kuat. Pertahankan strategi ini!`)
    else if (profitFactor >= 1.5) tips.push(`📊 Profit factor ${profitFactor.toFixed(2)} - cukup baik. Fokus pada cutting losers faster.`)
    else if (profitFactor > 0 && profitFactor < 1.5) tips.push(`🔴 Profit factor ${profitFactor.toFixed(2)} masih di bawah 1.5. Perbesar risk-to-reward ratio minimal 1:2.`)

    if (avgLoss > 0 && avgProfit > 0) {
      const rr = avgProfit / avgLoss
      if (rr >= 2) tips.push(`✅ Risk-to-reward ratio ${rr.toFixed(1)}:1 sangat sehat. Ini kunci profitabilitas jangka panjang.`)
      else if (rr >= 1) tips.push(`⚖️ R:R ratio ${rr.toFixed(1)}:1 masih bisa ditingkatkan. Target minimal 2:1 per trade.`)
      else tips.push(`🔻 R:R ratio ${rr.toFixed(1)}:1 perlu perhatian. Average loss lebih besar dari profit!`)
    }

    if (maxDrawdown > 500) tips.push(`📉 Max drawdown $${maxDrawdown.toFixed(0)} cukup besar. Pertimbangkan untuk mengurangi lot size.`)
    else if (maxDrawdown > 200) tips.push(`📉 Drawdown $${maxDrawdown.toFixed(0)} masih wajar, tapi atur stop loss harian untuk membatasinya.`)

    if (totalTrades > 50) tips.push(`🔁 Dengan ${totalTrades} trades, data sudah cukup signifikan untuk analisis. Keep journaling!`)
    else if (totalTrades >= 10) tips.push(`📝 ${totalTrades} trades sudah cukup untuk mulai melihat pola. Tambahkan lebih banyak data.`)
    else tips.push(`📊 Minimal 30 trades diperlukan untuk statistik yang reliable. Terus catat trading Anda!`)

    if (totalPL > 0) tips.push(`💚 Total profit $${totalPL.toFixed(2)} - great job! Disiplin dengan trading plan Anda.`)
    else if (totalPL < 0) tips.push(`💔 Total loss $${Math.abs(totalPL).toFixed(2)}. Jangan force trades. Fokus pada quality over quantity.`)

    const psychTips = [
      '🧠 Jurnal trading bukan hanya tentang angka. Catat juga emosi dan kondisi market.',
      '💪 Disiplin lebih penting dari strategi. Follow your rules consistently.',
      '⏸️ Ketika 3x loss berturut-turut, stop trading. Refresh mind lalu review setup.',
      '📋 Buat checklist sebelum entry: setup valid? stop loss? risk < 2%? Jika YA, baru entry.',
    ]
    tips.push(psychTips[Math.floor(Math.random() * psychTips.length)])
  }

  return tips.join('\n\n')
}

function generateMarketInsight(lang: 'id' | 'en'): string {
  if (lang === 'en') {
    const sections = [
      `🌍 **Today's Market Sessions:**\n\n` +
      `• **Asia (00:00-08:00 WIB):** Usually ranging on major pairs. Watch for breakout at London open.\n` +
      `• **London (14:00-23:00 WIB):** Most volatile session. Watch EU/UK economic data.\n` +
      `• **New York (19:00-04:00 WIB):** High volume, often reversals. Watch NFP, FOMC, CPI.`,
      `🛡️ **Risk Management Reminder:**\n\n` +
      `• Max risk per trade: 1-2% of balance\n` +
      `• Always use stop loss\n` +
      `• Don't average down on losing positions\n` +
      `• Set daily loss limit to protect your balance`,
      `🧠 **Trading Psychology:**\n\n` +
      `• Don't revenge trade after a loss\n` +
      `• Focus on the process, not individual trade results\n` +
      `• Review your journal every weekend\n` +
      `• Quality trades > quantity trades`,
      `📊 **Today's Tips:**\n\n` +
      `• Watch support/resistance levels on H4 and D1 timeframes\n` +
      `• Multi-timeframe analysis before entry (D1 → H4 → H1)\n` +
      `• Record successful and failed setups in your journal`,
    ]
    const shuffled = sections.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3).join('\n\n')
  }

  const sessions = [
    `🌍 **Sesi Pasar Hari Ini:**\n\n` +
    `• **Asia (00:00-08:00 WIB):** Biasanya ranging pada pair mayor. Watch untuk breakout di London open.\n` +
    `• **London (14:00-23:00 WIB):** Sesi paling volatile. Perhatikan data ekonomi EU/UK.\n` +
    `• **New York (19:00-04:00 WIB):** Volume tinggi, sering terjadi reversal. Watch NFP, FOMC, CPI.`,
  ]
  const riskReminders = [
    `🛡️ **Risk Management Reminder:**\n\n` +
    `• Max risk per trade: 1-2% dari balance\n` +
    `• Selalu gunakan stop loss\n` +
    `• Jangan averaging down pada posisi loss\n` +
    `• Target daily loss limit untuk proteksi balance`,
  ]
  const psychTips = [
    `🧠 **Trading Psychology:**\n\n` +
    `• Jangan revenge trading setelah loss\n` +
    `• Fokus pada proses, bukan hasil per trade\n` +
    `• Review jurnal setiap akhir minggu\n` +
    `• Quality trades > quantity trades`,
  ]
  const extras = [
    `📊 **Tips Hari Ini:**\n\n` +
    `• Perhatikan support/resistance level di timeframe H4 dan D1\n` +
    `• Multi-timeframe analysis sebelum entry (D1 → H4 → H1)\n` +
    `• Catat setup yang berhasil dan yang gagal di journal Anda`,
  ]
  const allSections = [sessions[0], riskReminders[0], psychTips[0], extras[0]]
  const shuffled = allSections.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3).join('\n\n')
}

function generateChatResponse(message: string, data: Record<string, any>, lang: 'id' | 'en'): string {
  const msg = message.toLowerCase()
  const analytics = data?.analytics || {}
  const trades = data?.trades || []

  const isEn = lang === 'en'

  // Best session analysis
  if (msg.includes('sesi') || msg.includes('session') || msg.includes('terbaik') || msg.includes('best')) {
    if (analytics.sessionPerformance && analytics.sessionPerformance.length > 0) {
      const best = [...analytics.sessionPerformance].sort((a: any, b: any) => b.pl - a.pl)[0]
      const worst = [...analytics.sessionPerformance].sort((a: any, b: any) => a.pl - b.pl)[0]
      return isEn
        ? `📊 **Your Trading Session Analysis:**\n\n🏆 Best session: **${best.session}** - Profit: $${best.pl.toFixed(0)}, Win Rate: ${best.winRate.toFixed(0)}%\n🔻 Weakest session: **${worst.session}** - Profit: $${worst.pl.toFixed(0)}, Win Rate: ${worst.winRate.toFixed(0)}%\n\n💡 Tip: Focus on trading during ${best.session} for optimal profitability. Reduce trades in ${worst.session} or tighten your entry filter.`
        : `📊 **Analisis Sesi Trading Anda:**\n\n🏆 Sesi terbaik: **${best.session}** - Profit: $${best.pl.toFixed(0)}, Win Rate: ${best.winRate.toFixed(0)}%\n🔻 Sesi terlemah: **${worst.session}** - Profit: $${worst.pl.toFixed(0)}, Win Rate: ${worst.winRate.toFixed(0)}%\n\n💡 Tips: Fokus trading di sesi ${best.session} untuk profitabilitas optimal. Kurangi trade di sesi ${worst.session} atau tingkatkan filter entry.`
    }
    return isEn
      ? `📊 I don't have enough session data yet. Add more trades with session notes for accurate analysis.`
      : `📊 Saya belum punya cukup data sesi trading Anda. Tambahkan lebih banyak trades dengan catatan sesi untuk analisis yang akurat.`
  }

  // Win rate question
  if (msg.includes('win rate') || msg.includes('winrate') || msg.includes('persentase')) {
    const wr = analytics.winRate || 0
    const total = analytics.totalTrades || 0
    let assessment = ''
    if (isEn) {
      if (wr >= 60) assessment = 'Excellent! Your strategy has a positive edge.'
      else if (wr >= 50) assessment = 'Decent. Can still be improved by being more selective with setups.'
      else assessment = 'Needs improvement. Consider only entering setups with the highest probability.'
    } else {
      if (wr >= 60) assessment = 'Sangat bagus! Strategi Anda memiliki edge positif.'
      else if (wr >= 50) assessment = 'Cukup baik. Masih bisa ditingkatkan dengan lebih selektif memilih setup.'
      else assessment = 'Perlu perbaikan. Pertimbangkan untuk hanya entry pada setup dengan probabilitas tertinggi.'
    }
    return isEn
      ? `📈 **Win Rate:** ${wr.toFixed(1)}% from ${total} trades\n\n${assessment}\n\n💡 Tip: Record winning setups in your journal to identify patterns.`
      : `📈 **Win Rate:** ${wr.toFixed(1)}% dari ${total} trades\n\n${assessment}\n\n💡 Tips: Catat setup yang menang di jurnal untuk identifikasi pola.`
  }

  // Risk management
  if (msg.includes('risk') || msg.includes('resiko') || msg.includes('lot') || msg.includes('manajemen')) {
    return isEn
      ? `🛡️ **Risk Management Tips:**\n\n1. **Max 1-2% risk per trade** - If balance $1,000, max loss = $10-20\n2. **Always use stop loss** - No exceptions.\n3. **Risk:Reward minimum 1:2** - Loss $10, target profit $20+\n4. **Max 3 losses per day** - After 3 losses, stop. Refresh tomorrow.\n5. **Don't over-leverage** - Match lot size to your balance.\n\n📋 Rule of thumb: If you're uncomfortable with the potential loss, don't enter.`
      : `🛡️ **Tips Risk Management:**\n\n1. **Max 1-2% risk per trade** - Jika balance $1,000, max loss per trade = $10-20\n2. **Gunakan stop loss** - Selalu! Tanpa exception.\n3. **Risk:Reward minimal 1:2** - Loss $10, target profit $20+\n4. **Max 3 loss per hari** - Setelah 3x loss, stop. Refresh besok.\n5. **Jangan over-leverage** - Lot size sesuaikan dengan balance.\n\n📋 Rule of thumb: Jika Anda tidak nyaman dengan potensi loss, jangan entry.`
  }

  // Strategy question
  if (msg.includes('strategi') || msg.includes('strategy') || msg.includes('setup') || msg.includes('cara')) {
    return isEn
      ? `📋 **Strategy Tips:**\n\n1. **Multi-timeframe analysis** - Use D1 for trend, H4 for levels, H1 for entry\n2. **Wait for confirmation** - Don't enter before candle closes at support/resistance\n3. **Trade with the trend** - "Trend is your friend" still holds true\n4. **Record every trade** - Monthly analysis to find your edge\n5. **Backtest first** - Test strategy on demo before going live`
      : `📋 **Tips Strategi:**\n\n1. **Multi-timeframe analysis** - Gunakan D1 untuk trend, H4 untuk level, H1 untuk entry\n2. **Tunggu konfirmasi** - Jangan entry sebelum candle close di level support/resistance\n3. **Trade dengan trend** - "Trend is your friend" masih berlaku\n4. **Catat setiap trade** - Analisis bulanan untuk temukan edge Anda\n5. **Backtest** - Test strategi di demo sebelum pakai akun real`
  }

  // Performance question
  if (msg.includes('performa') || msg.includes('performance') || msg.includes('profit') || msg.includes('hasil')) {
    const pl = analytics.totalPL || 0
    const wr = analytics.winRate || 0
    const pf = analytics.profitFactor || 0
    return isEn
      ? `📊 **Your Trading Performance:**\n\n• Total P/L: **$${pl.toFixed(2)}**\n• Win Rate: **${wr.toFixed(1)}%**\n• Profit Factor: **${pf.toFixed(2)}**\n• Total Trades: **${analytics.totalTrades || 0}**\n\n${pl > 0 ? '✅ You\'re overall profitable! Maintain discipline and risk management.' : '❌ Still negative. Review your journal to identify loss patterns and improve.'}`
      : `📊 **Performa Trading Anda:**\n\n• Total P/L: **$${pl.toFixed(2)}**\n• Win Rate: **${wr.toFixed(1)}%**\n• Profit Factor: **${pf.toFixed(2)}**\n• Total Trades: **${analytics.totalTrades || 0}**\n\n${pl > 0 ? '✅ Overall Anda profitable! Pertahankan disiplin dan risk management.' : '❌ Masih negatif. Review jurnal untuk identifikasi pola loss dan perbaiki.'}`
  }

  // Default response
  const defaults = isEn
    ? [
        `🤖 I'm LuxTrade's AI Trading Coach. I can help analyze:\n\n• **"Best trading session"** - Session recommendations\n• **"What's my win rate?"** - Performance analysis\n• **"Risk management tips"** - Risk management advice\n• **"Good strategies?"** - Strategy recommendations\n• **"How's my performance?"** - Statistics summary\n\n📊 Ask me anything about your trading!`,
        `💡 **Quick Trading Tips:**\n\n1. Journaling is a trader's best weapon - 80% of profitable traders keep a journal\n2. Quality > Quantity - 5 great trades beat 20 random ones\n3. Weekly review: check win rate, R:R ratio, and emotion patterns\n4. Backtest before live trading\n5. Trading plan > no plan`
      ]
    : [
        `🤖 Saya adalah AI Trading Coach LuxTrade. Saya bisa membantu analisis:\n\n• **"Analisis sesi terbaik saya"** - Rekomendasi sesi trading\n• **"Bagaimana win rate saya?"** - Analisis performa\n• **"Tips risk management"** - Manajemen risiko\n• **"Strategi yang bagus?"** - Rekomendasi strategi\n• **"Bagaimana performa saya?"** - Ringkasan statistik\n\n📊 Tanyakan apa saja tentang trading Anda!`,
        `💡 **Quick Trading Tips:**\n\n1. Journaling adalah senjata terbaik trader - 80% trader profitable punya jurnal\n2. Quality > Quantity - 5 trades terbaik lebih baik dari 20 trades asal-asalan\n3. Review mingguan: cek win rate, R:R ratio, dan pola emosi\n4. Backtest sebelum live trade\n5. Trading plan > trading tanpa rencana`
      ]
  return defaults[Math.floor(Math.random() * defaults.length)]
}

// ==================== MAIN API HANDLER ====================

export async function POST(request: NextRequest) {
  try {
    // Auth check using shared utility
    const { error: authError, user } = await requireAuth(request)
    if (authError) return authError

    // PRO check - AI insights is a PRO feature
    const pro = await isUserPro(user!.id)
    if (!pro) {
      return NextResponse.json({
        error: 'AI Insights adalah fitur PRO. Upgrade ke PRO untuk menggunakan AI trading assistant!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
    }

    // Rate limit by user ID
    if (!checkAIRateLimit(user!.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { type, data, language } = body
    const lang: 'id' | 'en' = (language === 'en') ? 'en' : 'id'

    // Try ZAI for all types, with local fallback
    let zaiResponse: string | null = null

    switch (type) {
      case 'trade_analysis': {
        // Analyze a specific trade
        const trade = data || {}
        const systemPrompt = getSystemPrompt(lang)
        const userPrompt = getTradeAnalysisPrompt(lang, trade)

        zaiResponse = await askZAI(systemPrompt, userPrompt)

        if (!zaiResponse) {
          // Local fallback — language-aware with context from recent trades
          const pl = trade.profit_loss ? parseFloat(String(trade.profit_loss)) : 0
          const recentTrades = trade._recentTrades || []
          const analytics = trade._analytics || {}
          const winRate = analytics.winRate || 0
          const totalPL = analytics.totalPL || 0

          // Pattern analysis from recent trades
          const profitableCount = recentTrades.filter((t: any) => t.profit_loss > 0).length
          const lossCount = recentTrades.filter((t: any) => t.profit_loss < 0).length
          const bestSession = recentTrades.length > 0
            ? recentTrades.reduce((acc: any, t: any) => {
                if (!acc[t.session]) acc[t.session] = { pl: 0, count: 0 }
                acc[t.session].pl += t.profit_loss || 0
                acc[t.session].count++
                return acc
              }, {})
            : {}

          const bestSess = Object.entries(bestSession).sort((a: any, b: any) => (b[1] as any).pl - (a[1] as any).pl)[0]

          if (pl > 0) {
            zaiResponse = lang === 'en'
              ? `✅ **Trade Analysis:**\n\nTrade ${trade.symbol} ${trade.type} was profitable at $${pl.toFixed(2)}.\n\n• Entry: $${trade.open_price || trade.entry_price} → Exit: $${trade.close_price || trade.exit_price}\n• Note "${trade.strategy || 'N/A'}" as a successful setup.\n${recentTrades.length > 1 ? `\n📊 **Context:** From your last ${recentTrades.length} trades: ${profitableCount} wins, ${lossCount} losses. Win Rate: ${winRate.toFixed(1)}%. Total P/L: $${totalPL.toFixed(2)}.${bestSess ? ` Best session: ${bestSess[0]}` : ''}` : ''}\n💡 Repeat this pattern in similar market conditions for consistency.`
              : `✅ **Analisis Trade:**\n\nTrade ${trade.symbol} ${trade.type} menghasilkan profit $${pl.toFixed(2)}.\n\n• Entry: $${trade.open_price || trade.entry_price} → Exit: $${trade.close_price || trade.exit_price}\n• Catat strategi "${trade.strategy || 'N/A'}" sebagai setup yang berhasil.\n${recentTrades.length > 1 ? `\n📊 **Konteks:** Dari ${recentTrades.length} trade terakhir: ${profitableCount} menang, ${lossCount} kalah. Win Rate: ${winRate.toFixed(1)}%. Total P/L: $${totalPL.toFixed(2)}.${bestSess ? ` Sesi terbaik: ${bestSess[0]}` : ''}` : ''}\n💡 Ulangi pola ini di kondisi market serupa untuk konsistensi.`
          } else if (pl < 0) {
            zaiResponse = lang === 'en'
              ? `❌ **Trade Analysis:**\n\nTrade ${trade.symbol} ${trade.type} resulted in a loss of $${Math.abs(pl).toFixed(2)}.\n\n• Entry: $${trade.open_price || trade.entry_price} → Exit: $${trade.close_price || trade.exit_price}\n• ${trade.notes ? `Notes: "${trade.notes}"` : 'Record what went wrong in your journal.'}\n${recentTrades.length > 1 ? `\n📊 **Context:** From your last ${recentTrades.length} trades: ${profitableCount} wins, ${lossCount} losses. Win Rate: ${winRate.toFixed(1)}%.${lossCount > profitableCount ? ' ⚠️ You have more losses than wins recently. Consider reducing position size.' : ''}` : ''}\n💡 Review: Was stop loss too tight? Were you trading against the trend?`
              : `❌ **Analisis Trade:**\n\nTrade ${trade.symbol} ${trade.type} mengalami loss $${Math.abs(pl).toFixed(2)}.\n\n• Entry: $${trade.open_price || trade.entry_price} → Exit: $${trade.close_price || trade.exit_price}\n• ${trade.notes ? `Catatan: "${trade.notes}"` : 'Catat apa yang salah di journal.'}\n${recentTrades.length > 1 ? `\n📊 **Konteks:** Dari ${recentTrades.length} trade terakhir: ${profitableCount} menang, ${lossCount} kalah. Win Rate: ${winRate.toFixed(1)}%.${lossCount > profitableCount ? ' ⚠️ Loss lebih banyak dari win. Pertimbangkan untuk mengurangi lot size.' : ''}` : ''}\n💡 Review: Apakah stop loss terlalu dekat? Apakah melawan trend?`
          } else {
            zaiResponse = lang === 'en'
              ? `📝 **Trade Analysis:**\n\nTrade ${trade.symbol} ${trade.type} recorded.\n\n• Entry: $${trade.open_price || trade.entry_price} → Exit: $${trade.close_price || trade.exit_price}\n• ${trade.notes || 'No additional notes.'}\n${recentTrades.length > 1 ? `\n📊 **Context:** ${recentTrades.length} trades analyzed. Win Rate: ${winRate.toFixed(1)}%.` : ''}\n💡 Record your insight after the trade closes for better analysis.`
              : `📝 **Analisis Trade:**\n\nTrade ${trade.symbol} ${trade.type} dicatat.\n\n• Entry: $${trade.open_price || trade.entry_price} → Exit: $${trade.close_price || trade.exit_price}\n• ${trade.notes || 'Tidak ada catatan tambahan.'}\n${recentTrades.length > 1 ? `\n📊 **Konteks:** ${recentTrades.length} trade dianalisis. Win Rate: ${winRate.toFixed(1)}%.` : ''}\n💡 Catat insight setelah trade ditutup untuk analisis yang lebih baik.`
          }
        }

        return NextResponse.json({ insight: zaiResponse })
      }

      case 'performance_tips': {
        // Performance analysis with ZAI
        const systemPrompt = getSystemPrompt(lang)
        const userPrompt = getPerformancePrompt(lang, data)

        zaiResponse = await askZAI(systemPrompt, userPrompt)

        // Local fallback
        if (!zaiResponse) {
          zaiResponse = generatePerformanceTips(data, lang)
        }

        return NextResponse.json({ insight: zaiResponse })
      }

      case 'market_insight': {
        const systemPrompt = getSystemPrompt(lang)
        const userPrompt = getMarketInsightPrompt(lang)

        zaiResponse = await askZAI(systemPrompt, userPrompt)

        if (!zaiResponse) {
          zaiResponse = generateMarketInsight(lang)
        }

        return NextResponse.json({ insight: zaiResponse })
      }

      case 'chat': {
        const systemPrompt = getSystemPrompt(lang)
        const userPrompt = getChatPrompt(lang, data.message, data.context)

        zaiResponse = await askZAI(systemPrompt, userPrompt)

        if (!zaiResponse) {
          zaiResponse = generateChatResponse(data.message, data.context, lang)
        }

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
