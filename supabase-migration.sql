-- ============================================================================
-- COMPLETE MIGRATION: Achievements & Mission System Tables
-- ============================================================================
-- This script can be run multiple times without errors
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: ACHIEVEMENTS TABLES
-- ============================================================================

-- Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  requirement TEXT,
  reward_type TEXT DEFAULT 'badge',
  reward_value TEXT,
  category TEXT DEFAULT 'trading',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(100) NOT NULL REFERENCES public.achievements(key) ON DROP CASCADE,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_key)
);

-- Create indexes for achievements tables
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_key ON public.user_achievements(achievement_key);
CREATE INDEX IF NOT EXISTS idx_achievements_key ON public.achievements(key);
CREATE INDEX IF NOT EXISTS idx_achievements_active ON public.achievements(is_active);

-- Enable RLS for achievements tables
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.achievements;
DROP POLICY IF EXISTS "Only admins can insert achievements" ON public.achievements;
DROP POLICY IF EXISTS "Only admins can update achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "System can insert user achievements" ON public.user_achievements;

-- RLS policies for achievements (public read, admin write)
CREATE POLICY "Achievements are viewable by everyone"
  ON public.achievements FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only admins can update achievements"
  ON public.achievements FOR UPDATE
  USING (true);

-- RLS policies for user_achievements
CREATE POLICY "Users can view own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert user achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (true);

-- Insert default achievements
INSERT INTO public.achievements (key, title, description, icon, requirement, reward_type, category) VALUES
  ('first-trade', 'First Trade', 'Execute your first trade', '🎯', 'Complete your first trade', 'badge', 'trading'),
  ('win-streak-3', '3 Win Streak', 'Win 3 trades in a row', '🔥', 'Win 3 consecutive trades', 'badge', 'trading'),
  ('win-streak-5', '5 Win Streak', 'Win 5 trades in a row', '🔥', 'Win 5 consecutive trades', 'badge', 'trading'),
  ('win-streak-10', '10 Win Streak', 'Win 10 trades in a row', '🔥', 'Win 10 consecutive trades', 'badge', 'trading'),
  ('profit-100', '$100 Profit', 'Achieve $100 profit', '💰', 'Reach $100 total profit', 'badge', 'trading'),
  ('profit-500', '$500 Profit', 'Achieve $500 profit', '💰', 'Reach $500 total profit', 'badge', 'trading'),
  ('profit-1000', '$1000 Profit', 'Achieve $1000 profit', '💰', 'Reach $1000 total profit', 'badge', 'trading'),
  ('trades-10', '10 Trades', 'Execute 10 trades', '📊', 'Complete 10 trades', 'badge', 'trading'),
  ('trades-50', '50 Trades', 'Execute 50 trades', '📊', 'Complete 50 trades', 'badge', 'trading'),
  ('trades-100', '100 Trades', 'Execute 100 trades', '📊', 'Complete 100 trades', 'badge', 'trading'),
  ('win-rate-50', '50% Win Rate', 'Achieve 50% win rate', '📈', 'Reach 50% win rate with min 10 trades', 'badge', 'trading'),
  ('win-rate-70', '70% Win Rate', 'Achieve 70% win rate', '📈', 'Reach 70% win rate with min 10 trades', 'badge', 'trading'),
  ('pro-upgrade', 'PRO Member', 'Upgrade to PRO plan', '⭐', 'Upgrade to PRO subscription', 'badge', 'subscription'),
  ('first-journal', 'First Journal', 'Write your first journal entry', '📝', 'Create your first journal entry', 'badge', 'trading'),
  ('daily-login-7', '7 Day Streak', 'Login 7 days in a row', '📅', 'Log in for 7 consecutive days', 'badge', 'engagement'),
  ('daily-login-30', '30 Day Streak', 'Login 30 days in a row', '📅', 'Log in for 30 consecutive days', 'badge', 'engagement')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- PART 2: MISSION SYSTEM TABLES
-- ============================================================================

-- Create user_submissions table (for manual achievement claims)
CREATE TABLE IF NOT EXISTS public.user_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(100) NOT NULL,
  proof_url TEXT,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create mission_progress table (to track mission progress)
CREATE TABLE IF NOT EXISTS public.mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_key VARCHAR(100) NOT NULL,
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mission_key)
);

-- Create indexes for mission tables
CREATE INDEX IF NOT EXISTS idx_user_submissions_user_id ON public.user_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_submissions_achievement_key ON public.user_submissions(achievement_key);
CREATE INDEX IF NOT EXISTS idx_user_submissions_status ON public.user_submissions(status);
CREATE INDEX IF NOT EXISTS idx_mission_progress_user_id ON public.mission_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_mission_progress_mission_key ON public.mission_progress(mission_key);
CREATE INDEX IF NOT EXISTS idx_mission_progress_completed ON public.mission_progress(completed);

-- Enable RLS for mission tables
ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Users can view own submissions" ON public.user_submissions;
DROP POLICY IF EXISTS "Users can insert own submissions" ON public.user_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.user_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.user_submissions;
DROP POLICY IF EXISTS "Users can view own progress" ON public.mission_progress;
DROP POLICY IF EXISTS "System can insert progress" ON public.mission_progress;
DROP POLICY IF EXISTS "System can update progress" ON public.mission_progress;

-- RLS policies for user_submissions
CREATE POLICY "Users can view own submissions"
  ON public.user_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own submissions"
  ON public.user_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions"
  ON public.user_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update submissions"
  ON public.user_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS policies for mission_progress
CREATE POLICY "Users can view own progress"
  ON public.mission_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert progress"
  ON public.mission_progress FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update progress"
  ON public.mission_progress FOR UPDATE
  WITH CHECK (true);

-- ============================================================================
-- PART 3: TRIGGERS FOR updated_at
-- ============================================================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_submissions
DROP TRIGGER IF EXISTS update_user_submissions_updated_at ON public.user_submissions;
CREATE TRIGGER update_user_submissions_updated_at
  BEFORE UPDATE ON public.user_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to mission_progress
DROP TRIGGER IF EXISTS update_mission_progress_updated_at ON public.mission_progress;
CREATE TRIGGER update_mission_progress_updated_at
  BEFORE UPDATE ON public.mission_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to achievements
DROP TRIGGER IF EXISTS update_achievements_updated_at ON public.achievements;
CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();