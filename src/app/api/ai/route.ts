import { NextRequest, NextResponse } from 'next/server'

// ==================== SMART LOCAL INSIGHT ENGINE ====================
// Generates insightful trading analysis without requiring external AI SDK.
// This ensures the feature works everywhere (sandbox + Vercel).

function generatePerformanceTips(data: Record<string, any>): string {
  const { totalTrades = 0, winRate = 0, totalPL = 0, avgProfit = 0, avgLoss = 0, profitFactor = 0, maxDrawdown = 0 } = data
  const tips: string[] = []

  // Win Rate Analysis
  if (winRate >= 70) {
    tips.push(`🎯 Win rate Anda ${winRate.toFixed(1)}% sangat baik! Fokus pada risk management agar konsisten.`)
  } else if (winRate >= 50) {
    tips.push(`📈 Win rate ${winRate.toFixed(1)}% sudah decent. Perbaiki entry timing untuk push ke atas 60%.`)
  } else if (winRate > 0) {
    tips.push(`⚠️ Win rate ${winRate.toFixed(1)}% perlu perbaikan. Coba kurangi overtrading dan tunggu setup yang lebih valid.`)
  }

  // Profit Factor
  if (profitFactor >= 2) {
    tips.push(`💰 Profit factor ${profitFactor.toFixed(2)} menunjukkan edge yang kuat. Pertahankan strategi ini!`)
  } else if (profitFactor >= 1.5) {
    tips.push(`📊 Profit factor ${profitFactor.toFixed(2)} - cukup baik. Fokus pada cutting losers faster.`)
  } else if (profitFactor > 0 && profitFactor < 1.5) {
    tips.push(`🔴 Profit factor ${profitFactor.toFixed(2)} masih di bawah 1.5. Perbesar risk-to-reward ratio minimal 1:2.`)
  }

  // Risk/Reward Analysis
  if (avgLoss > 0 && avgProfit > 0) {
    const rr = avgProfit / avgLoss
    if (rr >= 2) {
      tips.push(`✅ Risk-to-reward ratio ${rr.toFixed(1)}:1 sangat sehat. Ini kunci profitabilitas jangka panjang.`)
    } else if (rr >= 1) {
      tips.push(`⚖️ R:R ratio ${rr.toFixed(1)}:1 masih bisa ditingkatkan. Target minimal 2:1 per trade.`)
    } else {
      tips.push(`🔻 R:R ratio ${rr.toFixed(1)}:1 perlu perhatian. Average loss lebih besar dari profit!`)
    }
  }

  // Drawdown
  if (maxDrawdown > 0) {
    if (maxDrawdown > 500) {
      tips.push(`📉 Max drawdown $${maxDrawdown.toFixed(0)} cukup besar. Pertimbangkan untuk mengurangi lot size.`)
    } else if (maxDrawdown > 200) {
      tips.push(`📉 Drawdown $${maxDrawdown.toFixed(0)} masih wajar, tapi atur stop loss harian untuk membatasinya.`)
    }
  }

  // Trade Frequency
  if (totalTrades > 50) {
    tips.push(`🔁 Dengan ${totalTrades} trades, data sudah cukup signifikan untuk analisis. Keep journaling!`)
  } else if (totalTrades >= 10) {
    tips.push(`📝 ${totalTrades} trades sudah cukup untuk mulai melihat pola. Tambahkan lebih banyak data.`)
  } else {
    tips.push(`📊 Minimal 30 trades diperlukan untuk statistik yang reliable. Terus catat trading Anda!`)
  }

  // Total P/L
  if (totalPL > 0) {
    tips.push(`💚 Total profit $${totalPL.toFixed(2)} - great job! Disiplin dengan trading plan Anda.`)
  } else if (totalPL < 0) {
    tips.push(`💔 Total loss $${Math.abs(totalPL).toFixed(2)}. Jangan force trades. Fokus pada quality over quantity.`)
  }

  // General psychology tip
  const psychTips = [
    '🧠 Jurnal trading bukan hanya tentang angka. Catat juga emosi dan kondisi market.',
    '💪 Disiplin lebih penting dari strategi. Follow your rules consistently.',
    '⏸️ Ketika 3x loss berturut-turut, stop trading. Refresh mind lalu review setup.',
    '📋 Buat checklist sebelum entry: setup valid? stop loss? risk < 2%? Jika YA, baru entry.',
  ]
  tips.push(psychTips[Math.floor(Math.random() * psychTips.length)])

  return tips.join('\n\n')
}

function generateMarketInsight(): string {
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

  // Pick 2-3 random sections
  const allSections = [sessions[0], riskReminders[0], psychTips[0], extras[0]]
  const shuffled = allSections.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3).join('\n\n')
}

function generateChatResponse(message: string, data: Record<string, any>): string {
  const msg = message.toLowerCase()
  const analytics = data?.analytics || {}
  const trades = data?.trades || []

  // Best session analysis
  if (msg.includes('sesi') || msg.includes('session') || msg.includes('terbaik') || msg.includes('best')) {
    if (analytics.sessionPerformance && analytics.sessionPerformance.length > 0) {
      const best = [...analytics.sessionPerformance].sort((a: any, b: any) => b.pl - a.pl)[0]
      const worst = [...analytics.sessionPerformance].sort((a: any, b: any) => a.pl - b.pl)[0]
      return `📊 **Analisis Sesi Trading Anda:**\n\n` +
        `🏆 Sesi terbaik: **${best.session}** - Profit: $${best.pl.toFixed(0)}, Win Rate: ${best.winRate.toFixed(0)}%\n` +
        `🔻 Sesi terlemah: **${worst.session}** - Profit: $${worst.pl.toFixed(0)}, Win Rate: ${worst.winRate.toFixed(0)}%\n\n` +
        `💡 Tips: Fokus trading di sesi ${best.session} untuk profitabilitas optimal. Kurangi trade di sesi ${worst.session} atau tingkatkan filter entry.`
    }
    return `📊 Saya belum punya cukup data sesi trading Anda. Tambahkan lebih banyak trades dengan catatan sesi untuk analisis yang akurat.`
  }

  // Win rate question
  if (msg.includes('win rate') || msg.includes('winrate') || msg.includes('persentase')) {
    const wr = analytics.winRate || 0
    const total = analytics.totalTrades || 0
    let assessment = ''
    if (wr >= 60) assessment = 'Sangat bagus! Strategi Anda memiliki edge positif.'
    else if (wr >= 50) assessment = 'Cukup baik. Masih bisa ditingkatkan dengan lebih selektif memilih setup.'
    else assessment = 'Perlu perbaikan. Pertimbangkan untuk hanya entry pada setup dengan probabilitas tertinggi.'
    return `📈 **Win Rate:** ${wr.toFixed(1)}% dari ${total} trades\n\n${assessment}\n\n💡 Tips: Catat setup yang menang di jurnal untuk identifikasi pola.`
  }

  // Risk management
  if (msg.includes('risk') || msg.includes('resiko') || msg.includes('lot') || msg.includes('manajemen')) {
    return `🛡️ **Tips Risk Management:**\n\n` +
      `1. **Max 1-2% risk per trade** - Jika balance $1,000, max loss per trade = $10-20\n` +
      `2. **Gunakan stop loss** - Selalu! Tanpa exception.\n` +
      `3. **Risk:Reward minimal 1:2** - Loss $10, target profit $20+\n` +
      `4. **Max 3 loss per hari** - Setelah 3x loss, stop. Refresh besok.\n` +
      `5. **Jangan over-leverage** - Lot size sesuaikan dengan balance.\n\n` +
      `📋 Rule of thumb: Jika Anda tidak nyaman dengan potensi loss, jangan entry.`
  }

  // Strategy question
  if (msg.includes('strategi') || msg.includes('strategy') || msg.includes('setup') || msg.includes('cara')) {
    return `📋 **Tips Strategi:**\n\n` +
      `1. **Multi-timeframe analysis** - Gunakan D1 untuk trend, H4 untuk level, H1 untuk entry\n` +
      `2. **Tunggu konfirmasi** - Jangan entry sebelum candle close di level support/resistance\n` +
      `3. **Trade dengan trend** - "Trend is your friend" masih berlaku\n` +
      `4. **Catat setiap trade** - Analisis bulanan untuk temukan edge Anda\n` +
      `5. **Backtest** - Test strategi di demo sebelum pakai akun real`
  }

  // Recent performance
  if (msg.includes('performa') || msg.includes('performance') || msg.includes('profit') || msg.includes('hasil')) {
    const pl = analytics.totalPL || 0
    const wr = analytics.winRate || 0
    const pf = analytics.profitFactor || 0
    return `📊 **Performa Trading Anda:**\n\n` +
      `• Total P/L: **$${pl.toFixed(2)}**\n` +
      `• Win Rate: **${wr.toFixed(1)}%**\n` +
      `• Profit Factor: **${pf.toFixed(2)}**\n` +
      `• Total Trades: **${analytics.totalTrades || 0}**\n\n` +
      `${pl > 0 ? '✅ Overall Anda profitable! Pertahankan disiplin dan risk management.' : '❌ Masih negatif. Review jurnal untuk identifikasi pola loss dan perbaiki.'}`
  }

  // Default response
  const defaults = [
    `🤖 Saya adalah AI Trading Coach LuxTrade. Saya bisa membantu analisis:\n\n` +
    `• **"Analisis sesi terbaik saya"** - Rekomendasi sesi trading\n` +
    `• **"Bagaimana win rate saya?"** - Analisis performa\n` +
    `• **"Tips risk management"** - Manajemen risiko\n` +
    `• **"Strategi yang bagus?"** - Rekomendasi strategi\n` +
    `• **"Bagaimana performa saya?"** - Ringkasan statistik\n\n` +
    `📊 Tanyakan apa saja tentang trading Anda!`,

    `💡 **Quick Trading Tips:**\n\n` +
    `1. Journaling adalah senjata terbaik trader - 80% trader profitable punya jurnal\n` +
    `2. Quality > Quantity - 5 trades terbaik lebih baik dari 20 trades asal-asalan\n` +
    `3. Review mingguan: cek win rate, R:R ratio, dan pola emosi\n` +
    `4. Backtest sebelum live trade\n` +
    `5. Trading plan > trading tanpa rencana`,
  ]
  return defaults[Math.floor(Math.random() * defaults.length)]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    let prompt = ''

    switch (type) {
      case 'trade_analysis':
        prompt = `Analyze this trade and provide insights:
        Symbol: ${data.symbol}
        Type: ${data.type}
        Entry Price: $${data.entry_price}
        Exit Price: ${data.exit_price ? '$' + data.exit_price : 'Still open'}
        Quantity: ${data.quantity}
        P/L: ${data.profit_loss ? '$' + data.profit_loss.toFixed(2) : 'N/A'}
        Strategy: ${data.strategy || 'Not specified'}
        Notes: ${data.notes || 'No notes'}
        
        Provide a brief analysis (2-3 sentences) on what went well or could be improved.`
        break

      case 'performance_tips':
        // Use smart local engine directly
        return NextResponse.json({
          insight: generatePerformanceTips(data)
        })

      case 'market_insight':
        // Use smart local engine directly
        return NextResponse.json({
          insight: generateMarketInsight()
        })

      case 'chat':
        // Use smart local engine directly
        return NextResponse.json({
          insight: generateChatResponse(data.message, data.context)
        })

      default:
        return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 })
    }

    // For trade_analysis type, try SDK with local fallback
    let response: string | null = null

    // Try AI SDK first (only works in sandbox)
    try {
      const ZAI: any = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert trading coach and analyst. Provide concise, actionable insights in a friendly but professional tone.' },
          { role: 'user', content: prompt }
        ],
        thinking: { type: 'disabled' }
      })

      response = completion.choices[0]?.message?.content
    } catch {
      // SDK not available, use local fallback
      console.log('AI SDK not available, using local insight engine')
    }

    // Local fallback for trade analysis
    if (!response) {
      const pl = data.profit_loss ? parseFloat(data.profit_loss) : 0
      if (pl > 0) {
        response = `✅ **Trade Analysis:**\n\nTrade ${data.symbol} ${data.type} menghasilkan profit $${pl.toFixed(2)}.\n\n` +
          `• Entry: $${data.entry_price} → Exit: $${data.exit_price || 'N/A'}\n` +
          `• Catat strategi "${data.strategy || 'N/A'}" sebagai setup yang berhasil.\n` +
          `💡 Ulangi pola ini di kondisi market serupa untuk konsistensi.`
      } else if (pl < 0) {
        response = `❌ **Trade Analysis:**\n\nTrade ${data.symbol} ${data.type} mengalami loss $${Math.abs(pl).toFixed(2)}.\n\n` +
          `• Entry: $${data.entry_price} → Exit: $${data.exit_price || 'N/A'}\n` +
          `• ${data.notes ? `Notes: "${data.notes}"` : 'Catat apa yang salah di journal.'}\n` +
          `💡 Review: Apakah stop loss terlalu dekat? Apakah melawan trend?`
      } else {
        response = `📝 **Trade Analysis:**\n\nTrade ${data.symbol} ${data.type} dicatat.\n\n` +
          `• Entry: $${data.entry_price} → Exit: $${data.exit_price || 'N/A'}\n` +
          `• ${data.notes || 'No additional notes.'}\n` +
          `💡 Catat insight setelah trade ditutup untuk analisis yang lebih baik.`
      }
    }

    return NextResponse.json({
      insight: response || 'Unable to generate insight'
    })
  } catch (error) {
    console.error('AI Analysis error:', error)
    return NextResponse.json({
      error: 'Gagal generate insight. Coba lagi.',
      insight: null
    }, { status: 500 })
  }
}
