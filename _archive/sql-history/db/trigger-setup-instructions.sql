-- ============================================
-- STEP 1: CHECK IF PROFILES TABLE EXISTS
-- ============================================
-- Run this first to check profiles table status
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- ============================================
-- STEP 2: CREATE PROFILES TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  subscription_status TEXT DEFAULT 'FREE',
  is_pro BOOLEAN DEFAULT FALSE,
  subscription_until TIMESTAMPTZ,
  pro_status TEXT DEFAULT 'inactive',
  pro_expiry_date TIMESTAMPTZ,
  affiliate_balance INTEGER DEFAULT 0,
  referral_count INTEGER DEFAULT 0,
  commission_paid BOOLEAN DEFAULT FALSE,
  has_ever_been_pro BOOLEAN DEFAULT FALSE,
  device_id TEXT,
  my_referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  referral_code_changes INTEGER DEFAULT 2,
  referral_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 3: ENABLE RLS (Row Level Security)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: CREATE RLS POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON public.profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- STEP 5: CREATE AUTO-UPDATE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- STEP 6: CREATE UPDATED_AT TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- STEP 7: CREATE AUTO-CREATE PROFILE FUNCTION
-- ============================================
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
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name'
    ),
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
    COALESCE(NEW.raw_user_meta_data->>'referral_code', NULL),
    2,
    NULL,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- STEP 8: CREATE TRIGGER FOR NEW USERS
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 9: VERIFY EVERYTHING
-- ============================================

-- Check profiles table count
SELECT 'Profiles table count:' as info, COUNT(*) as count FROM public.profiles;

-- Check if trigger exists
SELECT 'Trigger status:' as info, trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check all policies on profiles
SELECT 'Policies on profiles:' as info, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'profiles';

-- ============================================
-- STEP 10: TEST (Optional)
-- ============================================
-- Try to manually insert a test profile (remove after testing)
-- INSERT INTO public.profiles (id, email, full_name)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'Test User');

-- Check if inserted
-- SELECT * FROM public.profiles WHERE email = 'test@example.com';

-- Delete test
-- DELETE FROM public.profiles WHERE email = 'test@example.com';

-- ============================================
-- DONE!
-- ============================================
-- After running this SQL:
-- 1. Run: curl -X POST https://your-app.vercel.app/api/admin/populate-profiles
-- 2. Check profiles table in Supabase Table Editor
-- 3. Try registering a new user - profile should auto-create
