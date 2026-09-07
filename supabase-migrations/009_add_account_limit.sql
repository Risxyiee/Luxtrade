-- ============================================================================
-- ADD ACCOUNT LIMIT COLUMN TO USER_SUBSCRIPTIONS
-- ============================================================================
-- Date: 2025-09-07
-- Purpose: Add account_limit column to enforce free account limits
-- ============================================================================

-- Add account_limit column (default 1 for free users)
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS account_limit INTEGER DEFAULT 1;

-- Update existing free users to have account_limit = 1
UPDATE public.user_subscriptions
SET account_limit = 1
WHERE is_pro = false OR subscription_status = 'free';

-- Update PRO users to have higher account limit (unlimited = 999)
UPDATE public.user_subscriptions
SET account_limit = 999
WHERE is_pro = true AND subscription_status != 'free';

-- Add comment for documentation
COMMENT ON COLUMN public.user_subscriptions.account_limit IS 'Maximum number of trading accounts allowed (999 = unlimited)';

-- ============================================================================
-- SUCCESS: Script completed!
-- ============================================================================