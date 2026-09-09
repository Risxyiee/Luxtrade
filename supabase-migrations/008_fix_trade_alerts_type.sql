-- ============================================================================
-- FIX TRADE_ALERTS COLUMN TYPE
-- ============================================================================
-- Date: 2025-09-07
-- Purpose: Convert trade_alerts column from BOOLEAN to JSONB
-- ============================================================================

-- Drop existing column if it's BOOLEAN type
DO $$
BEGIN
  -- Check if column exists and is boolean type
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_preferences'
      AND column_name = 'trade_alerts'
      AND data_type = 'boolean'
  ) THEN
    -- Drop the boolean column
    ALTER TABLE public.notification_preferences DROP COLUMN IF EXISTS trade_alerts;
    RAISE NOTICE 'Dropped boolean trade_alerts column';
  END IF;
END $$;

-- Add trade_alerts as JSONB column (this will only execute if column doesn't exist)
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS trade_alerts JSONB DEFAULT '{"bigWin": true, "bigLoss": true, "streak": true, "dailyLimit": true}'::jsonb;

-- Verify the column is now JSONB
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notification_preferences'
  AND column_name = 'trade_alerts';

-- ============================================================================
-- SUCCESS: Script completed!
-- ============================================================================