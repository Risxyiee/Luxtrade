-- ============================================
-- COMPLETE SUPABASE DATABASE SETUP WITH UUID
-- Based on exact schema.prisma structure
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Hapus tabel lama jika ada (agar tidak konflik)
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS trading_accounts CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS weekly_goals CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS user_submissions CASCADE;
DROP TABLE IF EXISTS mission_progress CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;

-- 2. Buat tabel Profiles (Pusat data user) - camelCase sesuai schema.prisma
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  "streakCount" INTEGER DEFAULT 0,
  "lastLoginAt" TIMESTAMP WITH TIME ZONE,
  "bestStreak" INTEGER DEFAULT 0,
  achievements JSONB DEFAULT '[]'::jsonb,
  plan TEXT DEFAULT 'FREE',
  "proExpiry" TIMESTAMP WITH TIME ZONE,
  role TEXT DEFAULT 'USER',
  "full_name" TEXT,
  "is_pro" BOOLEAN DEFAULT false,
  "subscription_until" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Buat tabel Users - camelCase sesuai schema.prisma
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  "emailVerified" TIMESTAMP WITH TIME ZONE,
  image TEXT,
  role TEXT DEFAULT 'USER',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Buat tabel UserSubmissions - camelCase sesuai schema.prisma
CREATE TABLE user_submissions (
  id SERIAL PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "achievementKey" TEXT NOT NULL,
  "proofUrl" TEXT,
  status TEXT DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Buat tabel MissionProgress - camelCase sesuai schema.prisma
CREATE TABLE mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "missionKey" TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mission_progress_userId_missionKey_key" UNIQUE ("userId", "missionKey")
);

-- 6. Buat tabel UserSubscriptions - camelCase sesuai schema.prisma
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  "startDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Buat tabel Withdrawals - camelCase sesuai schema.prisma
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  "bankName" TEXT NOT NULL,
  "bankAccount" TEXT NOT NULL,
  "bankHolder" TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  "adminNote" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Buat tabel Trading Accounts - snake_case sesuai schema.prisma
CREATE TABLE trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  broker TEXT,
  account_type TEXT DEFAULT 'STANDARD',
  account_number TEXT,
  initial_balance DOUBLE PRECISION DEFAULT 0,
  current_balance DOUBLE PRECISION DEFAULT 0,
  leverage INTEGER DEFAULT 100,
  currency TEXT DEFAULT 'USD',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Buat tabel Journal Entries - snake_case sesuai schema.prisma
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  market_condition TEXT,
  tags TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Buat tabel Trades - snake_case sesuai schema.prisma
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  open_price DOUBLE PRECISION NOT NULL,
  close_price DOUBLE PRECISION NOT NULL,
  lot_size DOUBLE PRECISION NOT NULL,
  profit_loss DOUBLE PRECISION NOT NULL,
  open_time TIMESTAMP WITH TIME ZONE NOT NULL,
  close_time TIMESTAMP WITH TIME ZONE NOT NULL,
  session TEXT,
  notes TEXT,
  image_url TEXT,
  screenshot_url TEXT,
  emotion TEXT,
  setup_type TEXT,
  tags TEXT,
  risk_reward_ratio DOUBLE PRECISION,
  trade_duration INTEGER,
  linked_journal_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Buat tabel Tags - snake_case sesuai schema.prisma
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#a855f7',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Buat tabel Weekly Goals - snake_case sesuai schema.prisma
CREATE TABLE weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start TIMESTAMP WITH TIME ZONE NOT NULL,
  target_trades INTEGER DEFAULT 10,
  target_profit DOUBLE PRECISION,
  current_trades INTEGER DEFAULT 0,
  current_profit DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk performa agar web tidak lemot
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_account_id ON trades(account_id);
CREATE INDEX idx_trades_close_time ON trades(close_time DESC);
CREATE INDEX idx_trading_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_weekly_goals_user_id ON weekly_goals(user_id);
CREATE INDEX idx_user_submissions_userId ON user_submissions("userId");
CREATE INDEX idx_mission_progress_userId ON mission_progress("userId");

-- Verification
SELECT '========================================' AS info;
SELECT '✅ Database setup with UUID complete!' AS status;
SELECT '========================================' AS info;
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'trading_accounts', 'trades', 'journal_entries', 'tags', 'weekly_goals')
ORDER BY table_name, ordinal_position;
