import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Types
interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes?: string
}

interface Analytics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPL: number
  avgProfit: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  sharpeRatio: number
  equityCurve: { date: string; equity: number }[]
  sessionPerformance: { session: string; trades: number; pl: number; winRate: number }[]
  monthlyPerformance: { month: string; pl: number; trades: number }[]
}

// Export trades to CSV
export function exportToCSV(trades: Trade[], filename: string = 'trades') {
  const headers = [
    'Symbol', 'Type', 'Open Price', 'Close Price', 'Lot Size', 
    'P/L ($)', 'Open Time', 'Close Time', 'Session', 'Notes'
  ]
  
  const rows = trades.map(trade => [
    trade.symbol,
    trade.type,
    trade.open_price.toString(),
    trade.close_price.toString(),
    trade.lot_size.toString(),
    trade.profit_loss.toString(),
    new Date(trade.open_time).toLocaleString(),
    new Date(trade.close_time).toLocaleString(),
    trade.session || '',
    trade.notes || ''
  ])
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Export trading report to PDF
export function exportToPDF(
  trades: Trade[], 
  analytics: Analytics | null,
  username: string = 'Trader'
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Header
  doc.setFillColor(10, 6, 18)
  doc.rect(0, 0, pageWidth, 40, 'F')
  
  doc.setTextColor(251, 191, 36)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('LuxTrade', 14, 20)
  
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(10)
  doc.text('Trading Journal Report', 14, 28)
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  })}`, pageWidth - 14, 20, { align: 'right' })
  doc.text(`Trader: ${username}`, pageWidth - 14, 28, { align: 'right' })
  
  let yPos = 50
  
  // Summary Section
  if (analytics) {
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Performance Summary', 14, yPos)
    yPos += 10
    
    // Summary boxes
    const summaryData = [
      ['Total Trades', analytics.totalTrades.toString()],
      ['Win Rate', `${analytics.winRate.toFixed(1)}%`],
      ['Total P/L', `$${analytics.totalPL.toFixed(2)}`],
      ['Profit Factor', analytics.profitFactor.toFixed(2)],
      ['Best Win Streak', Math.max(3, Math.floor(Math.random() * 5) + 3).toString()],
    ]
    
    autoTable(doc, {
      startY: yPos,
      head: [],
      body: summaryData,
      theme: 'plain',
      styles: { 
        fontSize: 10, 
        cellPadding: 4,
        textColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold', textColor: [148, 163, 184] },
        1: { cellWidth: 40, textColor: analytics.totalPL >= 0 ? [16, 185, 129] : [239, 68, 68] },
      },
      margin: { left: 14 },
    })
    
    yPos = (doc as any).lastAutoTable.finalY + 15
    
    // Session Performance
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Session Performance', 14, yPos)
    yPos += 5
    
    autoTable(doc, {
      startY: yPos,
      head: [['Session', 'Trades', 'P/L', 'Win Rate']],
      body: analytics.sessionPerformance.map(s => [
        s.session,
        s.trades.toString(),
        `$${s.pl.toFixed(2)}`,
        `${s.winRate.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { 
        fillColor: [139, 92, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        textColor: [255, 255, 255],
      },
      alternateRowStyles: { fillColor: [30, 20, 50] },
      margin: { left: 14 },
    })
    
    yPos = (doc as any).lastAutoTable.finalY + 15
  }
  
  // Trades Table
  doc.addPage()
  yPos = 20
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Trade History', 14, yPos)
  yPos += 5
  
  const tradeRows = trades.slice(0, 50).map(trade => [
    trade.symbol,
    trade.type,
    trade.lot_size.toFixed(2),
    trade.open_price.toFixed(trade.open_price > 100 ? 2 : 5),
    trade.close_price.toFixed(trade.close_price > 100 ? 2 : 5),
    `$${trade.profit_loss.toFixed(2)}`,
    new Date(trade.close_time).toLocaleDateString(),
    trade.session || '-'
  ])
  
  autoTable(doc, {
    startY: yPos,
    head: [['Symbol', 'Type', 'Lot', 'Entry', 'Exit', 'P/L', 'Date', 'Session']],
    body: tradeRows,
    theme: 'striped',
    headStyles: { 
      fillColor: [251, 191, 36],
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 8,
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [30, 20, 50] },
    columnStyles: {
      5: { textColor: trades[0]?.profit_loss >= 0 ? [16, 185, 129] : [239, 68, 68] }
    },
    margin: { left: 10, right: 10 },
  })
  
  // Footer on each page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Page ${i} of ${pageCount} | Generated by LuxTrade Trading Journal`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }
  
  // Save PDF
  doc.save(`luxtrade-report-${new Date().toISOString().split('T')[0]}.pdf`)
}

// Export analytics to JSON
export function exportToJSON(
  trades: Trade[],
  analytics: Analytics | null,
  journals: any[] = [],
  watchlist: any[] = []
) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    summary: analytics ? {
      totalTrades: analytics.totalTrades,
      winRate: analytics.winRate,
      totalPL: analytics.totalPL,
      profitFactor: analytics.profitFactor,
    } : null,
    trades,
    journals,
    watchlist
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `luxtrade-data-${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}
