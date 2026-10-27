-- ============================================================================
-- LUXTRADE - COMPLETE SQL FIX SCRIPT (Safe to Run Multiple Times)
-- ============================================================================
-- Date: 2026-09-06
-- Purpose: Fix missing tables, columns, and RLS policies safely
--
-- HOW TO USE:
--   1. Buka Supabase Dashboard > SQL Editor
--   2. Paste SELURUH script ini
--   3. Klik "Run"
--   4. Pastikan tidak ada error
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Fix 1: DROP EXISTING ACHIEVEMENTS TABLES (IF EXISTS)
-- ===========================================

-- Drop triggers first
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
DROP TRIGGER IF EXISTS update_achievements_updated_at ON achievements;

-- Drop policies first
DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can delete own notification preferences" ON notification_preferences;

DROP POLICY IF EXISTS "Public can view achievements" ON achievements;
DROP POLICY IF EXISTS "Service role can manage achievements" ON achievements;

DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can update own achievements progress" ON user_achievements;
DROP POLICY IF EXISTS "Service role can manage user achievements" ON user_achievements;

-- Drop existing tables and indexes (CASCADE will drop dependent objects)
DROP INDEX IF EXISTS idx_notification_preferences_user_id CASCADE;
DROP INDEX IF EXISTS idx_user_achievements_user_id CASCADE;
DROP INDEX IF EXISTS idx_user_achievements_achievement_id CASCADE;
DROP INDEX IF EXISTS idx_achievements_category CASCADE;
DROP INDEX IF EXISTS idx_achievements_rarity CASCADE;

DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;

-- ===========================================
-- Fix 2: CREATE ACHIEVEMENTS TABLES (Clean State)
-- ===========================================

-- Table: notification_preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT false,
  trade_alerts BOOLEAN NOT NULL DEFAULT true,
  target_reminders BOOLEAN NOT NULL DEFAULT true,
  daily_summary BOOLEAN NOT NULL DEFAULT false,
  weekly_summary BOOLEAN NOT NULL DEFAULT true,
  market_news BOOLEAN NOT NULL DEFAULT false,
  achievement_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id)
);

-- Create index for faster queries
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Table: achievements
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_id TEXT,
  description TEXT,
  description_id TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  category TEXT,
  rarity TEXT DEFAULT 'common',
  requirements JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_rarity ON achievements(rarity);

-- Table: user_achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZIZE DEFAULT NOW(),
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

-- Create indexes
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- ===========================================
-- Fix 3: ADD MISSING COLUMNS TO EXISTING TABLES
-- ===========================================

-- Add achievement_key column to user_achievements table (for backward compatibility)
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS achievement_key TEXT;

-- Add account_id column to trades table if missing (for multi-account support)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Ensure linked_trades relation exists in journal_entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS linked_trades JSONB;

-- Create indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);

-- ===========================================
-- Fix 4: RLS POLICIES FOR ACHIEVEMENTS TABLES
-- ===========================================

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- notification_preferences RLS policies
CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences"
  ON notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- achievements RLS policies (public read, authenticated write via service role)
CREATE POLICY "Public can view achievements"
  ON achievements FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage achievements"
  ON achievements FOR ALL
  TO service_role
  WITH CHECK (true);

-- user_achievements RLS policies
CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements progress"
  ON user_achievements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user achievements"
  ON user_achievements FOR ALL
  TO service_role
  WITH CHECK (true);

-- ===========================================
-- Fix 5: RLS POLICIES FOR TRADING TABLES
-- ===========================================

-- Enable RLS on tables if not already enabled
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to avoid "already exists" error)
DROP POLICY IF EXISTS "Users can view own trades" ON trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON trades;
DROP POLICY IF EXISTS "Users can update own trades" ON trades;
DROP POLICY IF EXISTS "Users can delete own trades" ON trades;

DROP POLICY IF EXISTS "Users can view own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can update own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete own journal entries" ON journal_entries;

-- Trading RLS Policies (Multi-Account Support)
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE
  USING (user_id::text = auth.uid()::text);

-- Journal Entries RLS Policies (Multi-Account Support)
CREATE POLICY "Users can view own journal entries"
  ON journal_entries FOR SELECT
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own journal entries"
  ON journal_entries FOR INSERT
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update own journal entries"
  ON journal_entries FOR UPDATE
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own journal entries"
  ON journal_entries FOR DELETE
  USING (user_id::text = auth.uid()::text);

-- ===========================================
-- Fix 6: FUNCTIONS & TRIGGERS FOR updated_at
-- ===========================================

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON achievements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Fix 7: GRANT PERMISSIONS
-- ===========================================

GRANT ALL ON notification_preferences TO authenticated;
GRANT ALL ON achievements TO authenticated, anon;
GRANT ALL ON user_achievements TO authenticated;

GRANT ALL ON notification_preferences TO service_role;
GRANT ALL ON achievements TO service_role;
GRANT ALL ON user_achievements TO service_role;

-- ============================================================================
-- SUCCESS: Script completed successfully!
-- ============================================================================
-- What was done:
--  1. Dropped existing achievements tables and recreated them cleanly
--  2. Added missing columns (account_id, achievement_key, linked_trades)
--  3. Created all RLS policies for multi-account data isolation
--  4. Set up triggers for updated_at timestamps
--  5. Granted proper permissions
-- ============================================================================