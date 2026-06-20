-- Add promoCodeId column to user_subscriptions table
-- Run this in Supabase SQL Editor

-- Check if column exists first, then add if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_subscriptions'
    AND column_name = 'promoCodeId'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN "promoCodeId" TEXT;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_promo_code_id ON user_subscriptions("promoCodeId");

-- Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_subscriptions'
AND column_name = 'promoCodeId';