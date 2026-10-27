-- ============================================
-- COMPLETE DATABASE SETUP FOR SUPABASE
-- Run this in Supabase Dashboard → SQL Editor
-- This script will create all required tables or fix existing ones
-- ============================================

-- ============================================
-- SECTION 1: DROP EXISTING TABLES (FRESH START)
-- Uncomment the lines below ONLY if you want to start fresh
-- This will DELETE ALL EXISTING DATA!
-- ============================================

-- DROP TABLE IF EXISTS user_subscriptions CASCADE;
-- DROP TABLE IF EXISTS withdrawals CASCADE;
-- DROP TABLE IF EXISTS weekly_goals CASCADE;
-- DROP TABLE IF EXISTS tags CASCADE;
-- DROP TABLE IF EXISTS journal_entries CASCADE;
-- DROP TABLE IF EXISTS trades CASCADE;
-- DROP TABLE IF EXISTS trading_accounts CASCADE;
-- DROP TABLE IF EXISTS mission_progress CASCADE;
-- DROP TABLE IF EXISTS user_submissions CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- SECTION 2: CREATE ALL TABLES
-- ============================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  "streakCount" INTEGER DEFAULT 0,
  "lastLoginAt" TIMESTAMP,
  "bestStreak" INTEGER DEFAULT 0,
  achievements JSONB DEFAULT '[]'::jsonb,
  plan TEXT DEFAULT 'FREE',
  "proExpiry" TIMESTAMP,
  role TEXT DEFAULT 'USER',
  "full_name" TEXT,
  "is_pro" BOOLEAN DEFAULT false,
  "subscription_until" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  "emailVerified" TIMESTAMP,
  image TEXT,
  role TEXT DEFAULT 'USER',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Submissions table
CREATE TABLE IF NOT EXISTS user_submissions (
  id SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "achievementKey" TEXT NOT NULL,
  proofUrl TEXT,
  status TEXT DEFAULT 'PENDING',
  reviewedBy TEXT,
  reviewedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES profiles(id) ON DELETE CASCADE
);

-- Mission Progress table
CREATE TABLE IF NOT EXISTS mission_progress (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  missionKey TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mission_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT "mission_progress_userId_missionKey_key" UNIQUE ("userId", missionKey)
);

-- User Subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  "startDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  "bankName" TEXT NOT NULL,
  "bankAccount" TEXT NOT NULL,
  "bankHolder" TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  adminNote TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Trading Accounts table
CREATE TABLE IF NOT EXISTS trading_accounts (
  id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  name TEXT NOT NULL,
  broker TEXT,
  "account_type" TEXT DEFAULT 'STANDARD',
  "account_number" TEXT,
  "initial_balance" DOUBLE PRECISION DEFAULT 0,
  "current_balance" DOUBLE PRECISION DEFAULT 0,
  leverage INTEGER DEFAULT 100,
  currency TEXT DEFAULT 'USD',
  "is_default" BOOLEAN DEFAULT false,
  "is_active" BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trading_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE
);

-- Journal Entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  "market_condition" TEXT,
  tags TEXT,
  "image_url" TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE
);

-- Trades table (with all required columns including close_time)
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "account_id" TEXT,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  "open_price" DOUBLE PRECISION NOT NULL,
  "close_price" DOUBLE PRECISION NOT NULL,
  "lot_size" DOUBLE PRECISION NOT NULL,
  "profit_loss" DOUBLE PRECISION NOT NULL,
  "open_time" TIMESTAMP NOT NULL,
  "close_time" TIMESTAMP NOT NULL,
  session TEXT,
  notes TEXT,
  "image_url" TEXT,
  "screenshot_url" TEXT,
  emotion TEXT,
  "setup_type" TEXT,
  tags TEXT,
  "risk_reward_ratio" DOUBLE PRECISION,
  "trade_duration" INTEGER,
  "linked_journal_id" TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT "trades_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES trading_accounts(id) ON DELETE SET NULL,
  CONSTRAINT "trades_linked_journal_id_fkey" FOREIGN KEY ("linked_journal_id") REFERENCES journal_entries(id) ON DELETE SET NULL
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#a855f7',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE
);

-- Weekly Goals table
CREATE TABLE IF NOT EXISTS weekly_goals (
  id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "week_start" TIMESTAMP NOT NULL,
  "target_trades" INTEGER DEFAULT 10,
  "target_profit" DOUBLE PRECISION,
  "current_trades" INTEGER DEFAULT 0,
  "current_profit" DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE
);

-- ============================================
-- SECTION 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS "idx_trades_user_id" ON trades("user_id");
CREATE INDEX IF NOT EXISTS "idx_trades_close_time" ON trades("close_time" DESC);
CREATE INDEX IF NOT EXISTS "idx_trades_account_id" ON trades("account_id");
CREATE INDEX IF NOT EXISTS "idx_trading_accounts_user_id" ON trading_accounts("user_id");
CREATE INDEX IF NOT EXISTS "idx_journal_entries_user_id" ON journal_entries("user_id");
CREATE INDEX IF NOT EXISTS "idx_tags_user_id" ON tags("user_id");
CREATE INDEX IF NOT EXISTS "idx_weekly_goals_user_id" ON weekly_goals("user_id");

-- ============================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 5: RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profiles" ON profiles
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can insert own profiles" ON profiles
  FOR INSERT WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can update own profiles" ON profiles
  FOR UPDATE USING (auth.uid()::text = id);

-- Trades policies
CREATE POLICY "Users can view own trades" ON trades
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own trades" ON trades
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own trades" ON trades
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own trades" ON trades
  FOR DELETE USING (auth.uid()::text = user_id);

-- Trading Accounts policies
CREATE POLICY "Users can view own trading accounts" ON trading_accounts
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own trading accounts" ON trading_accounts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own trading accounts" ON trading_accounts
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own trading accounts" ON trading_accounts
  FOR DELETE USING (auth.uid()::text = user_id);

-- Journal Entries policies
CREATE POLICY "Users can view own journal entries" ON journal_entries
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own journal entries" ON journal_entries
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own journal entries" ON journal_entries
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own journal entries" ON journal_entries
  FOR DELETE USING (auth.uid()::text = user_id);

-- Tags policies
CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own tags" ON tags
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own tags" ON tags
  FOR DELETE USING (auth.uid()::text = user_id);

-- Weekly Goals policies
CREATE POLICY "Users can view own weekly goals" ON weekly_goals
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own weekly goals" ON weekly_goals
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own weekly goals" ON weekly_goals
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own weekly goals" ON weekly_goals
  FOR DELETE USING (auth.uid()::text = user_id);

-- ============================================
-- SECTION 6: VERIFICATION QUERIES
-- ============================================

-- Check all tables exist
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'users', 'trades', 'trading_accounts', 'journal_entries', 'tags', 'weekly_goals')
ORDER BY table_name;

-- Check trades table has close_time column
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'trades'
AND column_name = 'close_time';

-- Success message
SELECT '✅ Database setup complete! All tables and indexes created successfully.' AS status;
