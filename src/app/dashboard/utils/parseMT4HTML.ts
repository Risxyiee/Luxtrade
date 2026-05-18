import { Trade, MTReportPreview } from './types'

// ==================== SMART PDF/HTML PARSER ====================

export function parseMT4HTML(html: string): MTReportPreview | null {
  try {
    // Extract trades from MetaTrader HTML report
    const trades: Trade[] = []

    // Parse table rows - MT4/MT5 format
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
    const rows = html.match(rowRegex) || []

    let totalPL = 0
    let wins = 0
    let losses = 0
    let bestTrade = 0
    let worstTrade = 0

    rows.forEach((row, index) => {
      // Extract cells
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
      const cells: string[] = []
      let match
      while ((match = cellRegex.exec(row)) !== null) {
        cells.push(match[1].replace(/<[^>]*>/g, '').trim())
      }

      // Look for trade data (symbol, type, lots, open price, close price, profit)
      if (cells.length >= 6) {
        const symbolMatch = cells[0]?.match(/[A-Z]{3}[A-Z]{3}|[A-Z]{3}\/[A-Z]{3}|XAU|XAG/i)
        if (symbolMatch) {
          const profit = parseFloat(cells[cells.length - 1]?.replace(/[$,\s]/g, '') || '0')
          if (!isNaN(profit) && profit !== 0) {
            const trade: Trade = {
              id: `mt-${index}`,
              symbol: symbolMatch[0].toUpperCase(),
              type: cells[1]?.toLowerCase().includes('sell') ? 'SELL' : 'BUY',
              open_price: parseFloat(cells[3]?.replace(/[^0-9.]/g, '') || '0'),
              close_price: parseFloat(cells[4]?.replace(/[^0-9.]/g, '') || '0'),
              lot_size: parseFloat(cells[2]?.replace(/[^0-9.]/g, '') || '0.1'),
              profit_loss: profit,
              open_time: new Date().toISOString(),
              close_time: new Date().toISOString(),
              session: null,
              notes: 'Imported from MT4/MT5'
            }
            trades.push(trade)
            totalPL += profit
            if (profit > 0) wins++
            else losses++
            if (profit > bestTrade) bestTrade = profit
            if (profit < worstTrade) worstTrade = profit
          }
        }
      }
    })

    // Alternative: Look for summary data
    const profitMatch = html.match(/Total[:\s]+\$?(-?[0-9,]+\.?[0-9]*)/i) ||
                        html.match(/Profit[:\s]+\$?(-?[0-9,]+\.?[0-9]*)/i)
    const gainMatch = html.match(/Gain[:\s]+(-?[0-9.]+)%?/i)
    const tradesMatch = html.match(/Total Trades[:\s]+([0-9]+)/i)
    const winRateMatch = html.match(/Win\s*Rate[:\s]+([0-9.]+)%?/i)

    if (trades.length === 0 && (profitMatch || gainMatch)) {
      // Create summary from extracted data
      return {
        gain: gainMatch ? parseFloat(gainMatch[1]) : 0,
        profit: profitMatch ? parseFloat(profitMatch[1].replace(/,/g, '')) : 0,
        totalTrades: tradesMatch ? parseInt(tradesMatch[1]) : 0,
        winRate: winRateMatch ? parseFloat(winRateMatch[1]) : 0,
        bestTrade: 0,
        worstTrade: 0,
        avgTrade: 0,
        trades: []
      }
    }

    if (trades.length > 0) {
      return {
        gain: 0,
        profit: totalPL,
        totalTrades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        bestTrade,
        worstTrade,
        avgTrade: trades.length > 0 ? totalPL / trades.length : 0,
        trades
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing MT report:', error)
    return null
  }
}
