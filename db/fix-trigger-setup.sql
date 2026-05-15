-- ============================================
-- SAFE SETUP - Skip if already exists
-- ============================================

-- Step 1: Create profiles table if not exists
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

-- Step 2: Enable RLS (ignore error if already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'profiles'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Step 3: Create policies if not exists
CREATE POLICY IF NOT EXISTS "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Service role full access"
  ON public.profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- Step 4: Create auto-update function (always recreate)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Step 5: Create updated_at trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Step 6: Create auto-create profile function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, subscription_status, is_pro, subscription_until,
    pro_status, pro_expiry_date, affiliate_balance, referral_count,
    commission_paid, has_ever_been_pro, device_id, my_referral_code,
    referred_by_code, referral_code_changes, referral_status, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    'FREE', false, NULL, 'inactive', NULL, 0, 0, false, false, NULL, NULL,
    COALESCE(NEW.raw_user_meta_data->>'referral_code', NULL), 2, NULL, NOW(), NOW()
  );
  RETURN NEW;
END;
$$;

-- Step 7: Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Step 8: Verify
SELECT 'Profiles count:' as info, COUNT(*) as count FROM public.profiles;

SELECT 'Trigger status:' as info, trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

SELECT 'Policies count:' as info, COUNT(*) as count
FROM pg_policies
WHERE tablename = 'profiles';
