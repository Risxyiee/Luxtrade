/**
 * PDF Export Utilities for Trading Journal
 */

import html2pdf from 'html2pdf.js'

export interface JournalEntryForPDF {
  id: string
  title: string
  content: string
  mood?: string
  market_condition?: string
  tags?: string
  created_at: string
  image_url?: string
}

export interface TradeForCSV {
  id: string
  symbol: string
  type: string
  open_price: number
  close_price: number
  profit_loss: number
  open_time: string
  close_time: string
  stop_loss?: number
  take_profit?: number
  volume?: number
  ticket_number?: string
}

/**
 * Export journal entries to PDF
 */
export async function exportJournalToPDF(entries: JournalEntryForPDF[], filename = 'trading-journal.pdf') {
  if (entries.length === 0) {
    alert('No entries to export')
    return
  }

  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #fff;
            color: #333;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 15px;
          }
          .header h1 {
            font-size: 28px;
            color: #2563eb;
            margin-bottom: 5px;
          }
          .header p {
            color: #666;
            font-size: 14px;
          }
          .entry {
            margin-bottom: 25px;
            padding: 20px;
            border-left: 4px solid #2563eb;
            background: #f9f5ff;
            page-break-inside: avoid;
          }
          .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 12px;
          }
          .entry-title {
            font-size: 16px;
            font-weight: bold;
            color: #1f2937;
            flex: 1;
          }
          .entry-date {
            color: #666;
            font-size: 12px;
            white-space: nowrap;
            margin-left: 10px;
          }
          .entry-meta {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 12px;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
          }
          .badge-mood {
            background: #dbeafe;
            color: #1e40af;
          }
          .badge-market {
            background: #fce7f3;
            color: #831843;
          }
          .badge-tag {
            background: #d1fae5;
            color: #065f46;
          }
          .entry-content {
            color: #4b5563;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            color: #999;
            font-size: 12px;
          }
          .stats {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 Trading Journal Report</h1>
          <p>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div class="stats">
          <p><strong>Total Entries:</strong> ${entries.length}</p>
        </div>

        ${entries.map((entry, idx) => `
          <div class="entry">
            <div class="entry-header">
              <div class="entry-title">${idx + 1}. ${entry.title}</div>
              <div class="entry-date">${new Date(entry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
            </div>
            
            <div class="entry-meta">
              ${entry.mood ? `<span class="badge badge-mood">😊 ${entry.mood}</span>` : ''}
              ${entry.market_condition ? `<span class="badge badge-market">📈 ${entry.market_condition}</span>` : ''}
              ${entry.tags ? entry.tags.split(',').map((tag: string) => `<span class="badge badge-tag">${tag.trim()}</span>`).join('') : ''}
            </div>
            
            <div class="entry-content">${entry.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
        `).join('')}

        <div class="footer">
          <p>LuxTrade © 2026 | Trading Journal Report</p>
        </div>
      </body>
    </html>
  `

  const element = document.createElement('div')
  element.innerHTML = htmlContent

  const opt = {
    margin: 10,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  }

  html2pdf().set(opt).from(htmlContent).save()
}

/**
 * Export trades to CSV
 */
export function exportTradesToCSV(trades: TradeForCSV[], filename = 'trades.csv') {
  if (trades.length === 0) {
    alert('No trades to export')
    return
  }

  const headers = ['Symbol', 'Type', 'Open Price', 'Close Price', 'Profit/Loss', 'Open Time', 'Close Time', 'Stop Loss', 'Take Profit', 'Volume', 'Ticket Number']
  
  const rows = trades.map(trade => [
    trade.symbol,
    trade.type.toUpperCase(),
    trade.open_price,
    trade.close_price,
    trade.profit_loss,
    trade.open_time,
    trade.close_time,
    trade.stop_loss || '',
    trade.take_profit || '',
    trade.volume || '',
    trade.ticket_number || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export journal entries to CSV
 */
export function exportJournalToCSV(entries: JournalEntryForPDF[], filename = 'journal.csv') {
  if (entries.length === 0) {
    alert('No entries to export')
    return
  }

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
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export all user data (trades + journal) as JSON
 */
export function exportAllDataAsJSON(trades: any[], entries: any[], filename = 'luxtrade-backup.json') {
  const data = {
    exportDate: new Date().toISOString(),
    trades,
    journalEntries: entries
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Print journal entries
 */
export function printJournal(entries: JournalEntryForPDF[]) {
  if (entries.length === 0) {
    alert('No entries to print')
    return
  }

  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Trading Journal</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #fff;
            color: #333;
            padding: 20px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 15px;
          }
          .header h1 {
            font-size: 28px;
            color: #2563eb;
            margin-bottom: 5px;
          }
          .header p {
            color: #666;
            font-size: 14px;
          }
          .entry {
            margin-bottom: 25px;
            padding: 20px;
            border-left: 4px solid #2563eb;
            background: #f9f5ff;
            page-break-inside: avoid;
          }
          .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 12px;
          }
          .entry-title {
            font-size: 16px;
            font-weight: bold;
            color: #1f2937;
            flex: 1;
          }
          .entry-date {
            color: #666;
            font-size: 12px;
            white-space: nowrap;
            margin-left: 10px;
          }
          .entry-meta {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 12px;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
          }
          .badge-mood {
            background: #dbeafe;
            color: #1e40af;
          }
          .badge-market {
            background: #fce7f3;
            color: #831843;
          }
          .badge-tag {
            background: #d1fae5;
            color: #065f46;
          }
          .entry-content {
            color: #4b5563;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
          }
          @media print {
            body {
              padding: 0;
            }
            .header {
              page-break-after: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 Trading Journal</h1>
          <p>Printed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        ${entries.map((entry, idx) => `
          <div class="entry">
            <div class="entry-header">
              <div class="entry-title">${idx + 1}. ${entry.title}</div>
              <div class="entry-date">${new Date(entry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
            </div>
            
            <div class="entry-meta">
              ${entry.mood ? `<span class="badge badge-mood">😊 ${entry.mood}</span>` : ''}
              ${entry.market_condition ? `<span class="badge badge-market">📈 ${entry.market_condition}</span>` : ''}
              ${entry.tags ? entry.tags.split(',').map((tag: string) => `<span class="badge badge-tag">${tag.trim()}</span>`).join('') : ''}
            </div>
            
            <div class="entry-content">${entry.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
        `).join('')}
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.print()
  }
}
