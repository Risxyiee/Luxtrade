-- ============================================
-- Weekly Summary Emails Table
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.weekly_summary_emails (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  trade_count INT DEFAULT 0,
  total_pnl DOUBLE PRECISION DEFAULT 0,
  win_count INT DEFAULT 0,
  loss_count INT DEFAULT 0,
  best_trade DOUBLE PRECISION DEFAULT 0,
  worst_trade DOUBLE PRECISION DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMPTZ,
  unsubscribed BOOLEAN DEFAULT FALSE,
  unsubscribed_at TIMESTAMPTZ,
  CONSTRAINT uniq_weekly_summary_user_week UNIQUE (user_id, week_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_summary_user_id ON public.weekly_summary_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_summary_week ON public.weekly_summary_emails(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_summary_unsub ON public.weekly_summary_emails(user_id) WHERE unsubscribed = false;

-- RLS
ALTER TABLE public.weekly_summary_emails ENABLE ROW LEVEL SECURITY;

-- Policy: service role can do anything
CREATE POLICY "weekly_summary_service_role"
  ON public.weekly_summary_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: anon can UPDATE (for unsubscribe)
CREATE POLICY "weekly_summary_unsubscribe"
  ON public.weekly_summary_emails
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- GRANT
GRANT ALL ON public.weekly_summary_emails TO service_role;
GRANT SELECT, UPDATE ON public.weekly_summary_emails TO anon;
GRANT SELECT, UPDATE ON public.weekly_summary_emails TO authenticated;
