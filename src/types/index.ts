// ==================== SINGLE SOURCE OF TRUTH FOR SHARED TYPES ====================
// Re-export from existing specialized type files
export * from './trading-account'

// ==================== TRADE ====================

export interface Trade {
  id: string
  user_id?: string
  account_id?: string | null
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes?: string | null
  image_url?: string | null
  screenshot_url?: string | null
  emotion?: string | null
  setup_type?: string | null
  tags?: string | null
  risk_reward_ratio?: number | null
  trade_duration?: number | null
  linked_journal_id?: string | null
  created_at?: string
  updated_at?: string
}

// ==================== JOURNAL ENTRY ====================

export interface JournalEntry {
  id: string
  user_id?: string
  title: string
  content: string
  mood: string | null
  market_condition: string | null
  tags?: string | null
  image_url?: string | null
  linked_trades_count?: number
  created_at: string
  updated_at?: string
}

// ==================== WATCHLIST ITEM ====================

export interface WatchlistItem {
  id: string
  user_id?: string
  symbol: string
  name: string
  target_price: number | null
  notes: string | null
  created_at: string
}

// ==================== ANALYTICS ====================

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

// ==================== ACHIEVEMENT ====================

export interface Achievement {
  id: string
  title: string
  description: string
  category: 'trading' | 'engagement' | 'social'
  type: 'automatic' | 'manual'
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  reward: {
    type: 'pro_days' | 'badge' | 'special_feature'
    value: number | string
    label: string
  }
  criteria: {
    type: 'trade_count' | 'profit' | 'win_streak' | 'login_streak' | 'manual_proof'
    target: number
    description: string
  }
}

// ==================== USER PROFILE ====================

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  plan: 'free' | 'pro' | 'elite'
  trade_count: number
  created_at: string
}