import { Trade } from './types'
import { parseTradesFromCsv } from '@/lib/trade-csv-parser'

// ==================== CSV IMPORT UTILS ====================

// Parser dipindah ke src/lib/trade-csv-parser.ts (shared client+server) —
// sekarang mendukung file DENGAN header maupun TANPA header, delimiter
// TAB / koma / titik-koma terdeteksi otomatis. Format export jurnal
// sinyal (ticket, waktu, symbol, lot, harga, SL/TP, alesan, profit,
// durasi) tanpa header pun terbaca.
export function parseCSV(text: string): Trade[] {
  const parsed = parseTradesFromCsv(text)
  return parsed.map((t, i) => ({
    id: `csv-${i}`,
    symbol: t.symbol,
    type: t.type,
    open_price: t.open_price,
    close_price: t.close_price,
    lot_size: t.lot_size,
    profit_loss: t.profit_loss,
    open_time: t.open_time,
    close_time: t.close_time,
    session: t.session,
    notes: t.notes ?? null,
    stop_loss: t.stop_loss ?? null,
    take_profit: t.take_profit ?? null,
    ticket_number: t.ticket_number ?? null,
    trade_duration: t.trade_duration ?? null,
    risk_reward_ratio: t.risk_reward_ratio ?? null,
  }))
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
