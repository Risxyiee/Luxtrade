-- ============================================================================
-- LUXTRADE - CRITICAL BUG FIXES MIGRATION
-- ============================================================================
-- Date: 2026-09-06
-- Purpose: Fix missing columns, RLS policies, and permissions
--
-- RUN INSTRUCTIONS:
--   1. Open Supabase Dashboard > SQL Editor
--   2. Paste this entire script
--   3. Click "Run"
--   4. Verify no errors
-- ============================================================================

-- ============================================================================
-- FIX 1: Add missing total_xp column to profiles table
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;

-- ============================================================================
-- FIX 2: Ensure achievements and user_achievements tables exist with correct schema
-- ============================================================================

-- Drop existing policies first (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can update own achievements progress" ON user_achievements;
DROP POLICY IF EXISTS "Users can delete own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Service role can manage user achievements" ON user_achievements;

DROP POLICY IF EXISTS "Public can view achievements" ON achievements;
DROP POLICY IF EXISTS "Service role can manage achievements" ON achievements;

-- Create achievements table if not exists
CREATE TABLE IF NOT EXISTS achievements (
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

-- Create user_achievements table if not exists
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  achievement_key TEXT,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

-- ============================================================================
-- FIX 3: Create indexes for better performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements(rarity);

-- ============================================================================
-- FIX 4: Enable RLS on achievement tables
-- ============================================================================

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX 5: Create RLS policies for achievements table
-- ============================================================================

-- Public can view achievements (for frontend to show available achievements)
CREATE POLICY "Public can view achievements"
  ON achievements FOR SELECT
  USING (true);

-- Service role can manage achievements (for backend/admin)
CREATE POLICY "Service role can manage achievements"
  ON achievements FOR ALL
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- FIX 6: Create RLS policies for user_achievements table
-- ============================================================================

-- Authenticated users can view their own achievements
CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can insert their own achievements
CREATE POLICY "Users can insert own achievements"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own achievement progress
CREATE POLICY "Users can update own achievements progress"
  ON user_achievements FOR UPDATE
  USING (auth.uid() = user_id);

-- Authenticated users can delete their own achievements
CREATE POLICY "Users can delete own achievements"
  ON user_achievements FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage user achievements (for backend/admin)
CREATE POLICY "Service role can manage user achievements"
  ON user_achievements FOR ALL
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- FIX 7: Grant permissions for achievement tables
-- ============================================================================

-- Grant permissions to authenticated role
GRANT SELECT ON achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_achievements TO authenticated;

-- Grant permissions to anon role (for public viewing of achievements)
GRANT SELECT ON achievements TO anon;

-- Grant full permissions to service role
GRANT ALL ON achievements TO service_role;
GRANT ALL ON user_achievements TO service_role;

-- ============================================================================
-- FIX 8: Create updated_at trigger function if not exists
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX 9: Apply triggers for achievements tables
-- ============================================================================

DROP TRIGGER IF EXISTS update_achievements_updated_at ON achievements;

CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON achievements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS: All fixes applied successfully!
-- ============================================================================
-- Summary:
--  1. Added total_xp column to profiles table
--  2. Created/updated achievements table with proper schema
--  3. Created/updated user_achievements table with proper schema
--  4. Created performance indexes
--  5. Enabled RLS on both tables
--  6. Created proper RLS policies for data isolation
--  7. Granted proper permissions to authenticated, anon, and service_role
--  8. Set up automatic updated_at triggers
-- ============================================================================