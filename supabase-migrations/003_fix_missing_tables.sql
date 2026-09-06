-- ===========================================
-- Fix Missing Tables: notification_preferences, achievements, user_achievements
-- ===========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Table: notification_preferences
-- ===========================================
CREATE TABLE IF NOT EXISTS notification_preferences (
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
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- ===========================================
-- Table: achievements
-- ===========================================
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements(rarity);

-- ===========================================
-- Table: user_achievements
-- ===========================================
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- ===========================================
-- Row Level Security (RLS) Policies
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
-- Functions & Triggers for updated_at
-- ===========================================

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
-- Grant permissions
-- ===========================================

GRANT ALL ON notification_preferences TO authenticated;
GRANT ALL ON achievements TO authenticated, anon;
GRANT ALL ON user_achievements TO authenticated;

GRANT ALL ON notification_preferences TO service_role;
GRANT ALL ON achievements TO service_role;
GRANT ALL ON user_achievements TO service_role;

-- ===========================================
-- Comments for documentation
-- ===========================================

COMMENT ON TABLE notification_preferences IS 'User notification preferences for various alerts and summaries';
COMMENT ON TABLE achievements IS 'Achievement definitions and metadata';
COMMENT ON TABLE user_achievements IS 'User achievement unlocks and progress';