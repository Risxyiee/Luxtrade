const fs = require('fs');

const filePath = 'src/app/api/ai/route.ts';
const content = fs.readFileSync(filePath, 'utf-8');

// Find markers
const startMarker = '// Default: intelligent response using available data';
const endMarker = '// ==================== MAIN API HANDLER';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx < 0 || endIdx < 0) { console.error('Markers not found'); process.exit(1); }

const before = content.slice(0, startIdx);
const after = content.slice(endIdx);

// Build replacement
const rep = `
  // Default: intelligent response using available data
  const recentTradesSummary = trades.slice(0, 5).map(t =>
    t.symbol + ' ' + t.type + ': $' + ((t.profit_loss || 0) > 0 ? '+' : '') + (t.profit_loss || 0).toFixed(2)
  ).join(', ');

  // General performance summary
  if (msg.includes('performa') || msg.includes('performance') || msg.includes('profit') || msg.includes('hasil') || msg.includes('summary') || msg.includes('ringkasan') || msg.includes('statistik') || msg.includes('statistics')) {
    const avgPL = totalTrades > 0 ? (totalPL / totalTrades).toFixed(2) : '0';
    const pf = analytics.profitFactor || 0;
    const dd = analytics.maxDrawdown || 0;
    const monthly = analytics.monthlyPerformance || [];
    const lastMonth = monthly.length > 0 ? monthly[monthly.length - 1] : null;
    const statusEmoji = totalPL > 0 ? '\u2705' : '\u274c';
    const assessment = isId
      ? (totalPL > 0 && pf > 1.5
        ? 'Strategi Anda profitable dengan edge yang jelas. Fokus pada konsistensi dan scaling.'
        : totalPL > 0
          ? 'Profitable tapi edge tipis (PF < 1.5). Satu drawdown besar bisa menghapus profit. Perkuat risk management.'
          : 'Belum profitable. Tidak perlu banyak trade — fokus pada kualitas. Temukan 1-2 setup yang konsisten profit, lalu ulangi.')
      : (totalPL > 0 && pf > 1.5
        ? 'Your strategy is profitable with a clear edge. Focus on consistency and scaling.'
        : totalPL > 0
          ? 'Profitable but thin edge (PF < 1.5). One bad drawdown could wipe profits. Strengthen risk management.'
          : "Not yet profitable. You don\u2019t need more trades \u2014 focus on quality. Find 1-2 setups that consistently profit, then repeat."),
    const lastMonthBlock = lastMonth
      ? '\n**' + (isId ? 'Bulan Ini' : 'This Month') + ' (' + lastMonth.month + '):**\n\n' +
        '\u2022 P/L: \$' + lastMonth.pl.toFixed(0) + ' | ' + lastMonth.trades + ' trades\n' +
        '\u2022 Avg per trade: \$' + (lastMonth.pl / lastMonth.trades).toFixed(2)
      : '',

    return isId
      ? '\u{1f4ca} **Ringkasan Performa Lengkap:**\n\n**Angka Utama:**\n' +
        '\u2022 Total Trades: ' + totalTrades + ' | Win Rate: ' + winRate.toFixed(1) + '%\n' +
        '\u2022 Total P/L: **\$' + totalPL.toFixed(2) + '** ' + statusEmoji + '\n' +
        '\u2022 Rata-rata per Trade: **\$' + avgPL + '**\n' +
        '\u2022 Profit Factor: ' + pf.toFixed(2) + ' | Max Drawdown: \$' + dd.toFixed(0) + lastMonthBlock + '\n\n' +
        '**Assessment:**\n' + assessment
      : '\u{1f4ca} **Full Performance Summary:**\n\n**Key Numbers:**\n' +
        '\u2022 Total Trades: ' + totalTrades + ' | Win Rate: ' + winRate.toFixed(1) + '%\n' +
        '\u2022 Total P/L: **\$' + totalPL.toFixed(2) + '** ' + statusEmoji + '\n' +
        '\u2022 Average per Trade: **\$' + avgPL + '**\n' +
        '\u2022 Profit Factor: ' + pf.toFixed(2) + ' | Max Drawdown: \$' + dd.toFixed(0) + lastMonthBlock + '\n\n' +
        '**Assessment:**\n' + assessment;
  }

  return isId
    ? '\u{1f916} Saya bisa membantu analisis trading Anda! Data yang saya milik:\n\n' +
        '\u{1f4ca} ' + totalTrades + ' trades | WR ' + winRate.toFixed(1) + '% | P/L \$' + totalPL.toFixed(2) + '\n\n' +
        '\u{1f4dd} Trade terakhir: ' + (recentTradesSummary || 'Belum ada') + '\n\n' +
        'Tanyakan sesuatu yang spesifik, misalnya:\n' +
        '\u2022 \"Analisis sesi terbaik saya\" \u2014 saya akan breakdown performa per sesi\n' +
        '\u2022 \"Pair apa yang paling profitable?\" \u2014 analisis per symbol\n' +
        '\u2022 \"Bagaimana psikologi trading saya?\" \u2014 cek pola emosi dari data\n' +
        '\u2022 \"Tips risk management\" \u2014 saran berdasarkan data Anda'
      : '\u{1f916} I can help analyze your trading! Here\'s what I have:\n\n' +
        '\u{1f4ca} ' + totalTrades + ' trades | WR ' + winRate.toFixed(1) + '% | P/L \$' + totalPL.toFixed(2) + '\n\n' +
        '\u{1f4dd} Recent trades: ' + (recentTradesSummary || 'None yet') + '\n\n' +
        'Ask something specific, like:\n' +
        '\u2022 \"Analyze my best session\" \u2014 I\'ll breakdown performance per session\n' +
        '\u2022 \"Most profitable pair?\" \u2014 analysis by symbol\n' +
        '\u2022 \"How\'s my trading psychology?\" \u2014 check emotion patterns from data\n' +
        '\u2022 \"Risk management tips\" \u2014 advice based on your data'
    }
`;

fs.writeFileSync(filePath, before + rep + after, 'utf-8');
console.log('Fixed! Section from', startIdx, 'to', endIdx, '(' + (endIdx - startIdx) + ' bytes)');
