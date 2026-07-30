-- ============================================
-- Add Missing Profile Columns
-- Run this in Supabase SQL Editor
-- These columns are expected by the app code but missing from the DB
-- ============================================

-- Add missing columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_status TEXT DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'FREE';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_status TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS affiliate_balance INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_expiry_date TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code_changes INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Grant permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO service_role;

-- Notify Supabase to refresh schema cache
NOTIFY pgrst, 'reload schema';
