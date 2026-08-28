import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Trade as AppTrade, JournalEntry as AppJournalEntry, Analytics as AppAnalytics } from '@/types'

// Re-export types from the canonical source
export type Trade = AppTrade
export type JournalEntry = AppJournalEntry
export type Analytics = AppAnalytics

// ==================== HELPERS ====================

/** Calculate actual best win streak from trades data */
export function calculateBestWinStreak(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const sorted = [...trades].sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime())
  let maxStreak = 0
  let currentStreak = 0
  for (const trade of sorted) {
    if (trade.profit_loss > 0) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }
  return maxStreak
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

// ==================== CSV EXPORTS ====================

/** Export trades to CSV */
export function exportTradesToCSV(trades: Trade[], filename?: string) {
  if (trades.length === 0) return

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
  link.download = `${filename || 'trades'}-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** Export journal entries to CSV */
export function exportJournalToCSV(entries: JournalEntry[], filename?: string) {
  if (entries.length === 0) return

  const headers = ['Date', 'Title', 'Content', 'Mood', 'Market Condition', 'Tags']

  const rows = entries.map(entry => [
    new Date(entry.created_at).toLocaleDateString('en-US'),
    entry.title,
    entry.content.replace(/"/g, '""').replace(/\n/g, ' '),
    entry.mood || '',
    entry.market_condition || '',
    entry.tags || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename || 'journal'}-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ==================== JSON EXPORT ====================

/** Export all data (trades + journal + analytics) as JSON backup */
export function exportAllDataAsJSON(
  trades: Trade[],
  journals: JournalEntry[] = [],
  analytics: Analytics | null = null,
  filename?: string
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
    journals
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename || 'luxtrade-backup'}-${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// ==================== PDF EXPORTS ====================

/** Export trading report to PDF (dashboard report) */
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

    // Calculate actual best win streak
    const bestWinStreak = calculateBestWinStreak(trades)

    // Summary boxes
    const summaryData = [
      ['Total Trades', analytics.totalTrades.toString()],
      ['Win Rate', `${analytics.winRate.toFixed(1)}%`],
      ['Total P/L', `$${analytics.totalPL.toFixed(2)}`],
      ['Profit Factor', analytics.profitFactor.toFixed(2)],
      ['Best Win Streak', bestWinStreak.toString()],
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

/** Export journal entries to PDF using jsPDF autotable */
export function exportJournalToPDF(entries: JournalEntry[], filename?: string) {
  if (entries.length === 0) return

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const exportDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  // Blue header bar
  doc.setFillColor(37, 99, 235) // blue-600
  doc.rect(0, 0, pageWidth, 35, 'F')

  // Title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('LuxTrade Journal Report', 14, 18)

  // Subtitle
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${exportDate}  |  ${entries.length} entries`, 14, 27)

  let yPos = 45

  // Summary table
  const tableData = entries.map((entry, index) => [
    (index + 1).toString(),
    new Date(entry.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    entry.title,
    entry.mood || '-',
    entry.market_condition || '-',
    entry.tags ? entry.tags.split(',').map((t: string) => t.trim()).join(', ') : '-'
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Date', 'Title', 'Mood', 'Market', 'Tags']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [60, 60, 60],
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 55 },
      3: { cellWidth: 22 },
      4: { cellWidth: 28 },
      5: { cellWidth: 50 }
    },
    alternateRowStyles: {
      fillColor: [248, 245, 252]
    }
  })

  yPos = (doc as any).lastAutoTable?.finalY
    ? (doc as any).lastAutoTable.finalY + 10
    : yPos + 10

  // Each entry content section
  entries.forEach((entry) => {
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }

    // Entry title
    doc.setFontSize(12)
    doc.setTextColor(30, 64, 175) // blue-800
    doc.setFont('helvetica', 'bold')
    doc.text(entry.title, 14, yPos)
    yPos += 6

    // Entry date & mood
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    const entryDate = new Date(entry.created_at).toLocaleDateString('en-US', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    const metaParts = [entryDate]
    if (entry.mood) metaParts.push(`Mood: ${entry.mood}`)
    if (entry.market_condition) metaParts.push(`Market: ${entry.market_condition}`)
    doc.text(metaParts.join(' | '), 14, yPos)
    yPos += 6

    // Content (handle multi-line)
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    const lines = doc.splitTextToSize(entry.content, 180)
    doc.text(lines, 14, yPos)
    yPos += lines.length * 5 + 8
  })

  // Footer on each page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(37, 99, 235)
    doc.rect(0, 282, pageWidth, 15, 'F')
    doc.setTextColor(200, 220, 255)
    doc.setFontSize(8)
    doc.text('Generated by LuxTrade', 14, 290)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, 290, { align: 'right' })
  }

  doc.save(`${filename || 'luxtrade-journal'}-${new Date().toISOString().split('T')[0]}.pdf`)
}

// ==================== TAX REPORT (SPT INDONESIA) ====================

interface MonthlyTaxData {
  month: string
  monthIndex: number
  totalTrades: number
  grossProfit: number
  grossLoss: number
  netPL: number
}

/** Export Tax Report PDF — Indonesian SPT formatted, blue/white professional styling */
export function exportTaxReportPDF(trades: Trade[], username: string = 'Trader') {
  if (trades.length === 0) return

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const currentYear = new Date().getFullYear()

  // ---- Calculate monthly P/L data ----
  const monthlyMap = new Map<number, MonthlyTaxData>()
  for (const trade of trades) {
    const d = new Date(trade.close_time)
    if (d.getFullYear() !== currentYear) continue
    const m = d.getMonth() // 0-11
    const existing = monthlyMap.get(m) || {
      month: MONTH_NAMES_ID[m],
      monthIndex: m,
      totalTrades: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPL: 0,
    }
    existing.totalTrades++
    if (trade.profit_loss > 0) {
      existing.grossProfit += trade.profit_loss
    } else {
      existing.grossLoss += Math.abs(trade.profit_loss)
    }
    existing.netPL += trade.profit_loss
    monthlyMap.set(m, existing)
  }

  const monthData = Array.from(monthlyMap.values()).sort((a, b) => a.monthIndex - b.monthIndex)

  // ---- Header: Blue gradient bar ----
  doc.setFillColor(30, 64, 175) // blue-800
  doc.rect(0, 0, pageWidth, 42, 'F')

  // Lighter accent stripe
  doc.setFillColor(59, 130, 246) // blue-500
  doc.rect(0, 42, pageWidth, 3, 'F')

  // Title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Laporan Perdagangan LuxTrade', 14, 18)

  // Subtitle
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(191, 219, 254) // blue-200
  doc.text(`Tahun ${currentYear}  |  ${username}`, 14, 28)

  // Generated date on right
  doc.setTextColor(191, 219, 254)
  doc.setFontSize(9)
  doc.text(
    `Digenerate: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    pageWidth - 14, 28, { align: 'right' }
  )

  doc.setFontSize(8)
  doc.setTextColor(147, 197, 253) // blue-300
  doc.text('Dokumen untuk pelaporan pajak (SPT)', 14, 37)

  // ---- Summary boxes ----
  const totalNetPL = monthData.reduce((sum, m) => sum + m.netPL, 0)
  const totalProfit = monthData.reduce((sum, m) => sum + m.grossProfit, 0)
  const totalLoss = monthData.reduce((sum, m) => sum + m.grossLoss, 0)
  const totalTrades = monthData.reduce((sum, m) => sum + m.totalTrades, 0)

  let yPos = 52

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'bold')
  doc.text('RINGKASAN TAHUNAN', 14, yPos)
  yPos += 2

  autoTable(doc, {
    startY: yPos + 2,
    head: [],
    body: [
      ['Total Trade', totalTrades.toString()],
      ['Gross Profit', `$${totalProfit.toFixed(2)}`],
      ['Gross Loss', `($${totalLoss.toFixed(2)})`],
      ['Net P/L', totalNetPL >= 0 ? `+$${totalNetPL.toFixed(2)}` : `-$${Math.abs(totalNetPL).toFixed(2)}`],
    ],
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3,
      textColor: [60, 60, 60],
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', textColor: [100, 100, 100] },
      1: {
        cellWidth: 50,
        textColor: totalNetPL >= 0 ? [22, 163, 74] : [220, 38, 38],
        fontStyle: 'bold'
      },
    },
    margin: { left: 14 },
  })

  yPos = (doc as any).lastAutoTable.finalY + 12

  // ---- Monthly breakdown table ----
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'bold')
  doc.text('RINCIAN BULANAN', 14, yPos)
  yPos += 2

  const tableRows = monthData.map(m => [
    m.month,
    m.totalTrades.toString(),
    `$${m.grossProfit.toFixed(2)}`,
    `($${m.grossLoss.toFixed(2)})`,
    m.netPL >= 0 ? `+$${m.netPL.toFixed(2)}` : `-$${Math.abs(m.netPL).toFixed(2)}`,
  ])

  autoTable(doc, {
    startY: yPos + 4,
    head: [['Bulan', 'Total Trade', 'Gross Profit', 'Gross Loss', 'Net P/L']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: [60, 60, 60],
      lineColor: [200, 210, 230],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'right', textColor: [22, 163, 74], cellWidth: 40 },
      3: { halign: 'right', textColor: [220, 38, 38], cellWidth: 40 },
      4: { halign: 'right', fontStyle: 'bold', textColor: totalNetPL >= 0 ? [22, 163, 74] : [220, 38, 38], cellWidth: 40 },
    },
    alternateRowStyles: {
      fillColor: [239, 246, 255] // blue-50
    },
    margin: { left: 14, right: 14 },
  })

  yPos = (doc as any).lastAutoTable.finalY + 15

  // ---- Summary total row ----
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        'TOTAL',
        totalTrades.toString(),
        `$${totalProfit.toFixed(2)}`,
        `($${totalLoss.toFixed(2)})`,
        totalNetPL >= 0 ? `+$${totalNetPL.toFixed(2)}` : `-$${Math.abs(totalNetPL).toFixed(2)}`,
      ]
    ],
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 4,
      textColor: [60, 60, 60],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 40 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
    },
    margin: { left: 14, right: 14 },
  })

  // ---- Footer on each page ----
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    // Blue footer bar
    doc.setFillColor(30, 64, 175)
    doc.rect(0, 282, pageWidth, 15, 'F')

    // Light line above footer
    doc.setFillColor(59, 130, 246)
    doc.rect(0, 280, pageWidth, 2, 'F')

    doc.setTextColor(191, 219, 254)
    doc.setFontSize(8)
    doc.text('Laporan Perdagangan LuxTrade', 14, 290)
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, 290, { align: 'right' })
  }

  doc.save(`luxtrade-tax-report-${currentYear}-${new Date().toISOString().split('T')[0]}.pdf`)
}
