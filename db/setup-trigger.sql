-- ============================================
-- SETUP PROFILES TABLE TRIGGER
-- ============================================
-- Run this in Supabase SQL Editor to ensure auto-create profile works

-- 1. Check if function exists, recreate if needed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    subscription_status,
    is_pro,
    subscription_until,
    pro_status,
    pro_expiry_date,
    affiliate_balance,
    referral_count,
    commission_paid,
    has_ever_been_pro,
    device_id,
    my_referral_code,
    referred_by_code,
    referral_code_changes,
    referral_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name' OR NEW.raw_user_meta_data->>'name' OR NEW.raw_user_meta_data->>'full_name',
    'FREE',
    false,
    NULL,
    'inactive',
    NULL,
    0,
    0,
    false,
    false,
    NULL,
    NULL,
    NEW.raw_user_meta_data->>'referral_code',
    2,
    NULL,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- 2. Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 4. Verify trigger is created
SELECT
  trigger_name,
  event_object_table,
  action_statement,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 5. Check profiles count
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- ============================================
-- TEST TRIGGER (Optional)
-- ============================================
-- You can test by creating a new user via Supabase Auth
-- Then check: SELECT * FROM public.profiles ORDER BY created_at DESC LIMIT 1;

-- ============================================
-- NOTES
-- ============================================
-- After running this SQL:
-- 1. Any new user registration will auto-create profile
-- 2. Run POST /api/admin/populate-profiles to populate existing users
-- 3. Check profiles table in Supabase Table Editor
