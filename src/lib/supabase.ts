import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://biqtkulvmqtikflcmqad.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcXRrdWx2bXF0aWtmbGNtcWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQ3MDEsImV4cCI6MjA4NzcwMDcwMX0.d3MN6avJI53Py_xBMmJwtFRVmXLb6on9W5YwklPt9hY'

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. Auth features will not work.')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database types
export interface Trade {
  id: string
  symbol: string
  type: 'LONG' | 'SHORT' | 'BUY' | 'SELL'
  entry_price: number
  exit_price: number | null
  quantity: number
  lot_size?: number
  entry_date: string
  exit_date: string | null
  open_time?: string
  close_time?: string
  status: 'OPEN' | 'CLOSED'
  profit_loss: number | null
  profit_loss_percent: number | null
  strategy: string | null
  notes: string | null
  session?: string | null
  tags: string[] | null
  screenshot_url: string | null
  created_at: string
  updated_at: string
  user_id?: string
}

export interface JournalEntry {
  id: string
  title: string
  content: string
  mood: 'CONFIDENT' | 'NEUTRAL' | 'ANXIOUS' | 'FRUSTRATED' | null
  market_condition: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | null
  created_at: string
  updated_at: string
  user_id?: string
}

export interface WatchlistItem {
  id: string
  symbol: string
  name: string
  target_price: number | null
  notes: string | null
  created_at: string
  user_id?: string
}

export interface PerformanceMetric {
  id: string
  date: string
  total_trades: number
  winning_trades: number
  losing_trades: number
  total_profit: number
  win_rate: number
  avg_profit: number
  avg_loss: number
  sharpe_ratio: number | null
}

// Helper functions
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}
