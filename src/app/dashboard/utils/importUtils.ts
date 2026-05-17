import { Trade } from './types'

// ==================== CSV IMPORT UTILS ====================

export function parseCSV(text: string): Trade[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
  const trades: Trade[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length < 4) continue

    const symbolIdx = headers.findIndex(h => h.includes('symbol') || h.includes('pair'))
    const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('side') || h.includes('direction'))
    const openPriceIdx = headers.findIndex(h => h.includes('open') || h.includes('entry') || h.includes('entry_price'))
    const closePriceIdx = headers.findIndex(h => h.includes('close') || h.includes('exit') || h.includes('exit_price'))
    const plIdx = headers.findIndex(h => h.includes('pl') || h.includes('profit') || h.includes('pnl'))
    const lotIdx = headers.findIndex(h => h.includes('lot') || h.includes('size') || h.includes('volume'))
    const sessionIdx = headers.findIndex(h => h.includes('session'))
    const openTimeIdx = headers.findIndex(h => h.includes('open_time') || h.includes('entry_time'))
    const closeTimeIdx = headers.findIndex(h => h.includes('close_time') || h.includes('exit_time'))

    const trade: Trade = {
      id: `csv-${i}`,
      symbol: symbolIdx >= 0 ? values[symbolIdx].toUpperCase() : 'UNKNOWN',
      type: typeIdx >= 0 ? (values[typeIdx].toUpperCase().includes('SELL') ? 'SELL' : 'BUY') : 'BUY',
      open_price: openPriceIdx >= 0 ? parseFloat(values[openPriceIdx]) || 0 : 0,
      close_price: closePriceIdx >= 0 ? parseFloat(values[closePriceIdx]) || 0 : 0,
      lot_size: lotIdx >= 0 ? parseFloat(values[lotIdx]) || 0.1 : 0.1,
      profit_loss: plIdx >= 0 ? parseFloat(values[plIdx]) || 0 : 0,
      open_time: openTimeIdx >= 0 ? values[openTimeIdx] || new Date().toISOString() : new Date().toISOString(),
      close_time: closeTimeIdx >= 0 ? values[closeTimeIdx] || new Date().toISOString() : new Date().toISOString(),
      session: sessionIdx >= 0 ? values[sessionIdx] || null : null,
    }
    trades.push(trade)
  }

  return trades
}

// Helper: Convert file to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix for cleaner transmission
      const base64 = result.split(',')[1] || result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
