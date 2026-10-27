import sys

with open('src/app/api/ai/route.ts', 'rb') as f:
    content = f.read()

start_marker = b'// Default: intelligent response using available data'
end_marker = b'// ==================== MAIN API HANDLER'

if start_marker < 0 or end_marker < 0:
    print('Markers not found!')
    sys.exit(1)

before = content[:start]
after = content[end:]

# Build the replacement as bytes
lines = [
    b'// Default: intelligent response using available data',
    b'',
    b'',
    b'  const recentTradesSummary = trades.slice(0, 5).map(t =>',
    b'    t.symbol + " " + t.type + ": $" + (',
    b'      (t.profit_loss || 0) > 0 ? "+" : "") +',
    b'      (t.profit_loss || 0).toFixed(2)
    b'    )).join(', ")',
    b'',
    b'',
    b'  // General performance summary',
    b'  if (msg.includes(\'performa\') || msg.includes(\'performance\') || msg.includes(\'profit\') || msg.includes(\'hasil\') || msg.includes(\'summary\') || msg.includes(\'ringkasan\') || msg.includes(\'statistik\') || msg.includes(\'statistics\')) {',
    b'    const avgPL = totalTrades > 0 ? (totalPL / totalTrades).toFixed(2) : \"0\"',
    b'    const pf = analytics.profitFactor || 0',
    b'    const dd = analytics.maxDrawdown || 0',
    b'    const monthly = analytics.monthlyPerformance || []',
    b'    const lastMonth = monthly.length > 0 ? monthly[monthly.length - 1] : null',
    b'    const statusEmoji = totalPL > 0 ? \"\u2705\" : \"\u274c\"',
    b'    const assessment = isId',
    b'      ? (totalPL > 0 && pf > 1.5',
    b'        ? "Strategi Anda profitable dengan edge yang jelas. Fokus pada konsistensi dan scaling.",
    b'        : totalPL > 0',
    b'          ? "Profitable tapi edge tipis (PF < 1.5). Satu drawdown besar bisa menghapus profit. Perkuat risk management.",
    b'          : "Belum profitable. Tidak perlu banyak trade \u2014 fokus pada kualitas. Temukan 1-2 setup yang konsisten profit, lalu ulangi."),',
    b'      : (totalPL > 0 && pf > 1.5',
    b'        ? "Your strategy is profitable with a clear edge. Focus on consistency and scaling.",
    b'        : totalPL > 0',
    b'          ? "Profitable but thin edge (PF < 1.5). One bad drawdown could wipe profits. Strengthen risk management.",
    b'          : "Not yet profitable. You don\\\'t need more trades \u2014 focus on quality. Find 1-2 setups that consistently profit, then repeat."),',
    b'    const lastMonthBlock = lastMonth',
    b'      ? "\\n**" + (isId ? "Bulan Ini" : "This Month") + " (" + lastMonth.month + "):**\\n\\n" +',
    b'        "\u2022 P/L: $" + lastMonth.pl.toFixed(0) + " | " + lastMonth.trades + " trades\\n" +',
    b'        "\u2022 Avg per trade: $" + (lastMonth.pl / lastMonth.trades).toFixed(2)',
    b'      : "",',
    b'    return isId',
    b'      ? "\u{1f4ca} **Ringkasan Performa Lengkap:**\\n\\n**Angka Utama:**\\n" +',
    b'        "\u2022 Total Trades: " + totalTrades + " | Win Rate: " + winRate.toFixed(1) + "%\\n" +',
    b'        "\u2022 Total P/L: **$" + totalPL.toFixed(2) + "** " + statusEmoji + "\\n" +',
    b'        "\u2022 Rata-rata per Trade: **$" + avgPL + "**\\n" +',
    b'        "\u2022 Profit Factor: " + pf.toFixed(2) + " | Max Drawdown: $" + dd.toFixed(0) + lastMonthBlock + "\\n\\n" +',
    b'        "**Assessment:**\\n" + assessment,',
    b'      : "\u{1f4ca} **Full Performance Summary:**\\n\\n**Key Numbers:**\\n" +',
    b'        "\u2022 Total Trades: " + totalTrades + " | Win Rate: " + winRate.toFixed(1) + "%\\n" +',
    b'        "\u2022 Total P/L: **$" + totalPL.toFixed(2) + "** " + statusEmoji + "\\n" +',
    b'        "\u2022 Average per Trade: **$" + avgPL + "**\\n" +',
    b'        "\u2022 Profit Factor: " + pf.toFixed(2) + " | Max Drawdown: $" + dd.toFixed(0) + lastMonthBlock + "\\n\\n" +',
    b'        "**Assessment:**\\n" + assessment,',
    b'  }
',
    b'',
]

with open('src/app/api/ai/route.ts', 'wb') as f:
    f.write(before + b''.join(lines) + after)

print('Done!')
