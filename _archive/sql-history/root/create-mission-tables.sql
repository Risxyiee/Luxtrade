-- Create mission system tables
-- Run this in Supabase SQL Editor

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_submissions_user_id ON public.user_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_submissions_achievement_key ON public.user_submissions(achievement_key);
CREATE INDEX IF NOT EXISTS idx_user_submissions_status ON public.user_submissions(status);
CREATE INDEX IF NOT EXISTS idx_mission_progress_user_id ON public.mission_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_mission_progress_mission_key ON public.mission_progress(mission_key);
CREATE INDEX IF NOT EXISTS idx_mission_progress_completed ON public.mission_progress(completed);

-- Enable RLS
ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;

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

-- Enable updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_user_submissions_updated_at ON public.user_submissions;
CREATE TRIGGER update_user_submissions_updated_at
  BEFORE UPDATE ON public.user_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mission_progress_updated_at ON public.mission_progress;
CREATE TRIGGER update_mission_progress_updated_at
  BEFORE UPDATE ON public.mission_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();