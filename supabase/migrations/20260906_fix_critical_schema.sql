-- Critical Schema Fixes
-- Migration: 20260906_fix_critical_schema.sql

-- Fix 1: Add achievement_key column to user_achievements table
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS achievement_key TEXT;

-- Fix 2: Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- Fix 3: Add account_id column to trades table if missing
ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Fix 4: Ensure linked_trades relation exists in journal_entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS linked_trades JSONB;

-- Fix 5: Add index for account_id in trades
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);

-- Fix 6: Add index for user_id in journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);