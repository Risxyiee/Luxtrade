-- Add missing columns to user_subscriptions table
-- Run this in Supabase SQL Editor

-- Add discountPercent column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_subscriptions'
    AND column_name = 'discountPercent'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN "discountPercent" DOUBLE PRECISION DEFAULT 0;
  END IF;
END $$;

-- Verify all columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_subscriptions'
ORDER BY column_name;