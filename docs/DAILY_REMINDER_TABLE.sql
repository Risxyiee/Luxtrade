-- ============================================
-- Daily Reminder Emails Table
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_reminder_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  sent_date DATE NOT NULL,
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMPTZ,
  unsubscribed BOOLEAN DEFAULT FALSE,
  unsubscribed_at TIMESTAMPTZ,
  CONSTRAINT uniq_daily_reminder_user_date UNIQUE (user_id, sent_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_reminder_user ON public.daily_reminder_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reminder_date ON public.daily_reminder_logs(sent_date);
CREATE INDEX IF NOT EXISTS idx_daily_reminder_unsub ON public.daily_reminder_logs(user_id) WHERE unsubscribed = false;

-- RLS
ALTER TABLE public.daily_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_reminder_service_role"
  ON public.daily_reminder_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "daily_reminder_unsubscribe"
  ON public.daily_reminder_logs
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- GRANT
GRANT ALL ON public.daily_reminder_logs TO service_role;
GRANT SELECT, UPDATE ON public.daily_reminder_logs TO anon;
GRANT SELECT, UPDATE ON public.daily_reminder_logs TO authenticated;
