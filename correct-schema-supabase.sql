-- ============================================
-- CORRECT SQL: Based on exact schema.prisma structure
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Create all tables based on schema.prisma
-- ============================================

-- Profile table (camelCase: createdAt, updatedAt)
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

-- User table (camelCase: createdAt, updatedAt, emailVerified)
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

-- UserSubmission table (camelCase: userId, createdAt, updatedAt, reviewedAt)
CREATE TABLE IF NOT EXISTS user_submissions (
  id SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "achievementKey" TEXT NOT NULL,
  "proofUrl" TEXT,
  status TEXT DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MissionProgress table (camelCase: userId, createdAt, updatedAt)
CREATE TABLE IF NOT EXISTS mission_progress (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "missionKey" TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UserSubscription table (camelCase: userId, createdAt, updatedAt, startDate, endDate)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  "startDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Withdrawal table (camelCase: userId, createdAt, updatedAt)
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  "bankName" TEXT NOT NULL,
  "bankAccount" TEXT NOT NULL,
  "bankHolder" TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  "adminNote" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TradingAccount table (snake_case: user_id, created_at, updated_at, account_type, account_number, initial_balance, current_balance, is_default, is_active)
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
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- JournalEntry table (snake_case: user_id, created_at, updated_at, market_condition, image_url)
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  "market_condition" TEXT,
  tags TEXT,
  "image_url" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trade table (snake_case: user_id, account_id, created_at, updated_at, account_type, account_number, initial_balance, current_balance, is_default, is_active, open_price, close_price, lot_size, profit_loss, open_time, close_time, image_url, screenshot_url, setup_type, risk_reward_ratio, trade_duration, linked_journal_id)
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
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tag table (snake_case: user_id, created_at)
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#a855f7',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WeeklyGoal table (snake_case: user_id, week_start, target_trades, target_profit, current_trades, current_profit, created_at, updated_at)
CREATE TABLE IF NOT EXISTS weekly_goals (
  id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "week_start" TIMESTAMP NOT NULL,
  "target_trades" INTEGER DEFAULT 10,
  "target_profit" DOUBLE PRECISION,
  "current_trades" INTEGER DEFAULT 0,
  "current_profit" DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'active',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STEP 2: Add missing columns to existing tables
-- ============================================

DO $$
BEGIN
    -- Fix trades table columns (snake_case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'close_time') THEN
        ALTER TABLE trades ADD COLUMN "close_time" TIMESTAMP NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'open_time') THEN
        ALTER TABLE trades ADD COLUMN "open_time" TIMESTAMP NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'account_id') THEN
        ALTER TABLE trades ADD COLUMN "account_id" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'screenshot_url') THEN
        ALTER TABLE trades ADD COLUMN "screenshot_url" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'emotion') THEN
        ALTER TABLE trades ADD COLUMN "emotion" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'setup_type') THEN
        ALTER TABLE trades ADD COLUMN "setup_type" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'risk_reward_ratio') THEN
        ALTER TABLE trades ADD COLUMN "risk_reward_ratio" DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'trade_duration') THEN
        ALTER TABLE trades ADD COLUMN "trade_duration" INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'linked_journal_id') THEN
        ALTER TABLE trades ADD COLUMN "linked_journal_id" TEXT;
    END IF;

    -- Fix trading_accounts table columns (snake_case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trading_accounts' AND column_name = 'account_type') THEN
        ALTER TABLE trading_accounts ADD COLUMN "account_type" TEXT DEFAULT 'STANDARD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trading_accounts' AND column_name = 'account_number') THEN
        ALTER TABLE trading_accounts ADD COLUMN "account_number" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trading_accounts' AND column_name = 'initial_balance') THEN
        ALTER TABLE trading_accounts ADD COLUMN "initial_balance" DOUBLE PRECISION DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trading_accounts' AND column_name = 'current_balance') THEN
        ALTER TABLE trading_accounts ADD COLUMN "current_balance" DOUBLE PRECISION DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trading_accounts' AND column_name = 'is_default') THEN
        ALTER TABLE trading_accounts ADD COLUMN "is_default" BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trading_accounts' AND column_name = 'is_active') THEN
        ALTER TABLE trading_accounts ADD COLUMN "is_active" BOOLEAN DEFAULT true;
    END IF;
END $$;

-- ============================================
-- STEP 3: Create foreign key constraints
-- ============================================

-- Drop existing constraints if they exist to avoid conflicts
DO $$
BEGIN
    -- Drop trades foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trades_user_id_fkey') THEN
        ALTER TABLE trades DROP CONSTRAINT "trades_user_id_fkey";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trades_account_id_fkey') THEN
        ALTER TABLE trades DROP CONSTRAINT "trades_account_id_fkey";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trades_linked_journal_id_fkey') THEN
        ALTER TABLE trades DROP CONSTRAINT "trades_linked_journal_id_fkey";
    END IF;

    -- Drop trading_accounts foreign key
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trading_accounts_user_id_fkey') THEN
        ALTER TABLE trading_accounts DROP CONSTRAINT "trading_accounts_user_id_fkey";
    END IF;

    -- Drop journal_entries foreign key
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'journal_entries_user_id_fkey') THEN
        ALTER TABLE journal_entries DROP CONSTRAINT "journal_entries_user_id_fkey";
    END IF;

    -- Drop tags foreign key
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tags_user_id_fkey') THEN
        ALTER TABLE tags DROP CONSTRAINT "tags_user_id_fkey";
    END IF;

    -- Drop weekly_goals foreign key
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'weekly_goals_user_id_fkey') THEN
        ALTER TABLE weekly_goals DROP CONSTRAINT "weekly_goals_user_id_fkey";
    END IF;
END $$;

-- Create all foreign key constraints
ALTER TABLE trades ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE trades ADD CONSTRAINT "trades_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES trading_accounts(id) ON DELETE SET NULL;
ALTER TABLE trades ADD CONSTRAINT "trades_linked_journal_id_fkey" FOREIGN KEY ("linked_journal_id") REFERENCES journal_entries(id) ON DELETE SET NULL;

ALTER TABLE trading_accounts ADD CONSTRAINT "trading_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE journal_entries ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE tags ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE weekly_goals ADD CONSTRAINT "weekly_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE user_submissions ADD CONSTRAINT "user_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE mission_progress ADD CONSTRAINT "mission_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE user_subscriptions ADD CONSTRAINT "user_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE withdrawals ADD CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- ============================================
-- STEP 4: Create unique constraints
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'mission_progress_userId_missionKey_key') THEN
        ALTER TABLE mission_progress ADD CONSTRAINT "mission_progress_userId_missionKey_key" UNIQUE ("userId", "missionKey");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_email_key') THEN
        ALTER TABLE users ADD CONSTRAINT "users_email_key" UNIQUE (email);
    END IF;
END $$;

-- ============================================
-- STEP 5: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS "idx_trades_user_id" ON trades("user_id");
CREATE INDEX IF NOT EXISTS "idx_trades_close_time" ON trades("close_time" DESC);
CREATE INDEX IF NOT EXISTS "idx_trades_account_id" ON trades("account_id");
CREATE INDEX IF NOT EXISTS "idx_trading_accounts_user_id" ON trading_accounts("user_id");
CREATE INDEX IF NOT EXISTS "idx_journal_entries_user_id" ON journal_entries("user_id");
CREATE INDEX IF NOT EXISTS "idx_tags_user_id" ON tags("user_id");
CREATE INDEX IF NOT EXISTS "idx_weekly_goals_user_id" ON weekly_goals("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_submissions_userId" ON user_submissions("userId");
CREATE INDEX IF NOT EXISTS "idx_mission_progress_userId" ON mission_progress("userId");

-- ============================================
-- STEP 6: Verification
-- ============================================

-- Show all tables
SELECT 'All tables created successfully!' AS status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Verify trades table columns
SELECT 'Trades table columns (snake_case):' AS info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trades'
ORDER BY ordinal_position;

-- Verify trading_accounts table columns
SELECT 'TradingAccounts table columns (snake_case):' AS info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trading_accounts'
ORDER BY ordinal_position;

-- Verify profiles table columns
SELECT 'Profiles table columns (camelCase):' AS info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
