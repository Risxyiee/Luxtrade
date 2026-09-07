-- ============================================================================
-- FIX ISSUE #1: ADD MAX_DAILY LOSS & RLS POLICY FOR TRADING_ACCOUNTS
-- ============================================================================
-- Date: 2026-01-15
-- Purpose:
--   1. Add max_daily_loss column to notification_preferences table
--   2. Add RLS DELETE policy for trading_accounts table
--   3. Ensure proper schema for thresholds in notification_preferences
--
-- HOW TO USE:
--   1. Buka Supabase Dashboard > SQL Editor
--   2. Paste SELURUH script ini
--   3. Klik "Run"
--   4. Pastikan tidak ada error
-- ============================================================================

-- ===========================================
-- Fix 1: ADD MAX_DAILY LOSS COLUMN
-- ===========================================

-- Add max_daily_loss column to notification_preferences if not exists
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS max_daily_loss INTEGER DEFAULT 5;

-- Add thresholds JSONB column for storing frontend preference structure
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS thresholds JSONB DEFAULT '{"bigWinAmount": 100, "bigLossAmount": -100, "maxDailyLosses": 5}'::jsonb;

-- Add trade_alerts JSONB column for storing frontend preference structure
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS trade_alerts JSONB DEFAULT '{"bigWin": true, "bigLoss": true, "streak": true, "dailyLimit": true}'::jsonb;

-- Add email_digest column
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS email_digest TEXT DEFAULT 'daily' CHECK (email_digest IN ('daily', 'weekly', 'off'));

-- Add in_app column
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS in_app BOOLEAN DEFAULT true;

-- ===========================================
-- Fix 2: RLS DELETE POLICY FOR TRADING_ACCOUNTS
-- ===========================================

-- First, check if trading_accounts table exists and RLS is enabled
DO $$
BEGIN
  -- Create trading_accounts table if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trading_accounts'
  ) THEN
    CREATE TABLE public.trading_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      broker TEXT,
      account_type TEXT NOT NULL DEFAULT 'STANDARD',
      account_number TEXT,
      initial_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      current_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      leverage INTEGER NOT NULL DEFAULT 100,
      broker_gmt_offset INTEGER DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX idx_trading_accounts_user_id ON public.trading_accounts(user_id);
    CREATE INDEX idx_trading_accounts_account_number ON public.trading_accounts(account_number);

    RAISE NOTICE 'Created trading_accounts table';
  END IF;
END $$;

-- Enable RLS on trading_accounts
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to avoid errors)
DROP POLICY IF EXISTS "Users can view own trading accounts" ON public.trading_accounts;
DROP POLICY IF EXISTS "Users can insert own trading accounts" ON public.trading_accounts;
DROP POLICY IF EXISTS "Users can update own trading accounts" ON public.trading_accounts;
DROP POLICY IF EXISTS "Users can delete own trading accounts" ON public.trading_accounts;

-- Create RLS policies
CREATE POLICY "Users can view own trading accounts"
  ON public.trading_accounts FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own trading accounts"
  ON public.trading_accounts FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own trading accounts"
  ON public.trading_accounts FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own trading accounts"
  ON public.trading_accounts FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_accounts TO authenticated;
GRANT SELECT ON public.trading_accounts TO anon;

-- ===========================================
-- Fix 3: UPDATE NOTIFICATION_PREFERENCES RLS POLICIES
-- ===========================================

-- Enable RLS if not enabled
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can delete own notification preferences" ON notification_preferences;

-- Create RLS policies with proper user_id comparison
CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own notification preferences"
  ON notification_preferences FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Grant permissions
GRANT ALL ON notification_preferences TO authenticated;
GRANT SELECT ON notification_preferences TO anon;

-- ===========================================
-- Fix 4: UPDATE UPDATED_AT TRIGGER
-- ===========================================

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to notification_preferences if not exists
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to trading_accounts if not exists
DROP TRIGGER IF EXISTS update_trading_accounts_updated_at ON trading_accounts;
CREATE TRIGGER update_trading_accounts_updated_at
  BEFORE UPDATE ON trading_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS: Script completed successfully!
-- ============================================================================
-- What was done:
--  1. Added max_daily_loss column to notification_preferences table
--  2. Added thresholds JSONB column for storing threshold preferences
--  3. Added trade_alerts JSONB column for storing trade alert preferences
--  4. Added email_digest and in_app columns
--  5. Created trading_accounts table with complete schema if not exists
--  6. Added RLS DELETE policy for trading_accounts
--  7. Updated all RLS policies to use text comparison for UUID
--  8. Added updated_at triggers for both tables
-- ============================================================================