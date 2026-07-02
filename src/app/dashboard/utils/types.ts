// ==================== TYPES UNIQUE TO DASHBOARD UTILS ====================
// Shared domain types have been moved to @/types

export { Trade, JournalEntry, WatchlistItem, Analytics } from '@/types'

export interface TradeFormData {
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: string
  close_price: string
  lot_size: string
  profit_loss: string
  open_time: string
  close_time: string
  session: string
  notes: string
  image_url: string
  screenshot_url: string
  emotion: string
  account_id: string
  account_type: string
}

export interface MTReportPreview {
  gain: number
  profit: number
  totalTrades: number
  winRate: number
  bestTrade: number
  worstTrade: number
  avgTrade: number
  trades: Trade[]
}

export const emptyFormData: TradeFormData = {
  symbol: '',
  type: 'BUY',
  open_price: '',
  close_price: '',
  lot_size: '0.1',
  profit_loss: '',
  open_time: '',
  close_time: '',
  session: '',
  notes: '',
  image_url: '',
  screenshot_url: '',
  emotion: '',
  account_id: '',
  account_type: 'STANDARD',
}