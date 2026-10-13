-- Add ai_free_quota_used column to profiles table
-- This tracks free AI trial usage (max 3 per user)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_free_quota_used INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN profiles.ai_free_quota_used IS 'Tracks free AI trial usage (max 3)';