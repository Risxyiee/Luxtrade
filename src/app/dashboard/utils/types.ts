// ==================== INTERFACES ====================

export interface Trade {
  id: string
  user_id: string
  account_id: string | null
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes: string | null
  image_url: string | null
  screenshot_url: string | null
  emotion: string | null
  setup_type: string | null
  tags: string | null
  risk_reward_ratio: number | null
  trade_duration: number | null
  linked_journal_id: string | null
  created_at: string
  updated_at: string
}

export interface JournalEntry {
  id: string
  user_id: string
  title: string
  content: string
  mood: string | null
  market_condition: string | null
  tags: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface WatchlistItem {
  id: string
  user_id: string
  symbol: string
  name: string
  target_price: number | null
  notes: string | null
  created_at: string
}

export interface Analytics {
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
