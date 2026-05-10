import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Get base URL dynamically (works for both custom domain and Vercel domain)
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use window.location.origin
    return window.location.origin
  }
  // Server-side: use NEXT_PUBLIC_APP_URL or fallback
  return process.env.NEXT_PUBLIC_APP_URL || 'https://luxtrade-jade.vercel.app'
}

// Validate configuration
if (!supabaseUrl || supabaseUrl === 'undefined' || supabaseUrl.trim() === '') {
  console.warn('⚠️ NEXT_PUBLIC_SUPABASE_URL is not configured')
  console.warn('   Set NEXT_PUBLIC_SUPABASE_URL in Vercel Environment Variables')
}

if (!supabaseAnonKey || supabaseAnonKey === 'undefined' || supabaseAnonKey.trim() === '') {
  console.warn('⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured')
  console.warn('   Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Environment Variables')
}

// Ensure supabaseUrl is valid (fallback to prevent build errors)
const validSupabaseUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')
  ? supabaseUrl
  : 'https://klxkdrfsfcoankbaoejn.supabase.co'

// Create Supabase client (for client-side & regular operations)
export const supabase = createClient(validSupabaseUrl, supabaseAnonKey || 'placeholder-for-build', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  // Global configuration for custom domain support
  global: {
    headers: {
      'X-Client-Info': 'luxtrade-web'
    }
  }
})

// Create Supabase ADMIN client (for server-side admin operations like listUsers)
// Uses SERVICE_ROLE_KEY which has full admin privileges
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = (() => {
  if (!supabaseServiceRoleKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not configured. Admin operations will not work.')
    return null
  }

  return createClient(validSupabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
})()

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
