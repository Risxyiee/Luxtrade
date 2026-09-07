-- Fix RLS policies for achievements and user_achievements tables
-- Migration: 007_fix_achievements_rls.sql
-- Date: 2025-09-07

-- Enable RLS on achievements table if not already enabled
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can insert achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can update achievements" ON public.achievements;

-- Create new RLS policies for achievements table
-- Allow authenticated users to view all achievements
CREATE POLICY "Users can view achievements"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert achievements
CREATE POLICY "Users can insert achievements"
  ON public.achievements FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update achievements
CREATE POLICY "Users can update achievements"
  ON public.achievements FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS on user_achievements table if not already enabled
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can update own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can delete own achievements" ON public.user_achievements;

-- Create new RLS policies for user_achievements table
-- Allow authenticated users to view their own achievements
CREATE POLICY "Users can view own achievements"
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- Allow authenticated users to insert their own achievements
CREATE POLICY "Users can insert own achievements"
  ON public.user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

-- Allow authenticated users to update their own achievements
CREATE POLICY "Users can update own achievements"
  ON public.user_achievements FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- Allow authenticated users to delete their own achievements
CREATE POLICY "Users can delete own achievements"
  ON public.user_achievements FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.achievements TO authenticated, anon;
GRANT INSERT ON public.achievements TO authenticated;
GRANT UPDATE ON public.achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_achievements TO authenticated;