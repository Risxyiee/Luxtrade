-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Create notification_preferences table
-- Date: 2026-09-22
-- Issue: GET /api/notifications/preferences returns 500 with PGRST205
--        because the table doesn't exist in the database schema cache.
-- Fix: Create the table with proper RLS policies.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_digest TEXT NOT NULL DEFAULT 'daily' CHECK (email_digest IN ('daily', 'weekly', 'off')),
  trade_alerts JSONB NOT NULL DEFAULT '{"bigWin":true,"bigLoss":true,"streak":true,"dailyLimit":true}',
  thresholds JSONB NOT NULL DEFAULT '{"bigWinAmount":100,"bigLossAmount":-100,"maxDailyLosses":5}',
  in_app BOOLEAN NOT NULL DEFAULT true,
  max_daily_loss INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on user_id (one preference row per user)
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_user_id_unique UNIQUE (user_id);

-- Enable Row Level Security
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own preferences
CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Service role has full access (bypasses RLS anyway, but explicit)
CREATE POLICY "Service role has full access to notification preferences"
  ON public.notification_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
  ON public.notification_preferences (user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Also fix: Reload PostgREST schema cache so it picks up new table/column changes
-- Run this after applying the migration:
--   NOTIFY pgrst, 'reload schema';
-- Or in Supabase Dashboard: Database → Schema Cache → Reload
-- ═══════════════════════════════════════════════════════════════════════════════
