-- ============================================================================
-- ADD ACCOUNT LIMIT COLUMN TO USER_SUBSCRIPTIONS
-- ============================================================================
-- Date: 2025-09-07
-- Purpose: Add account_limit column to enforce free account limits
-- ============================================================================

-- Add account_limit column (default 1 for free users)
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS account_limit INTEGER DEFAULT 1;

-- Update free users (profiles.is_pro = false) to have account_limit = 1
UPDATE public.user_subscriptions us
SET account_limit = 1
FROM public.profiles p
WHERE us.user_id = p.id
AND (p.is_pro = false OR p.subscription_status = 'free' OR p.subscription_status IS NULL);

-- Update PRO users (profiles.is_pro = true) to have higher account limit (unlimited = 999)
UPDATE public.user_subscriptions us
SET account_limit = 999
FROM public.profiles p
WHERE us.user_id = p.id
AND p.is_pro = true;

-- Add comment for documentation
COMMENT ON COLUMN public.user_subscriptions.account_limit IS 'Maximum number of trading accounts allowed (999 = unlimited)';

-- ============================================================================
-- SUCCESS: Script completed!
-- ============================================================================