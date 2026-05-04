-- ============================================================
-- LuxTrade Supabase Database Setup
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- ============================================================

-- 0. NUCLEAR OPTION: Drop ALL triggers on auth.users
-- This fixes any broken triggers that cause "Database error saving new user"
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_table = 'users' AND trigger_schema = 'auth') LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS "' || r.trigger_name || '" ON auth.users';
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;

-- Drop any broken functions too
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.on_auth_user_created() CASCADE;

-- 1. Create profiles table with ALL required columns
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  subscription_status TEXT DEFAULT 'FREE',
  is_pro BOOLEAN DEFAULT FALSE,
  subscription_until TIMESTAMPTZ,
  
  -- Affiliate columns
  device_id TEXT,
  my_referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  affiliate_balance INTEGER DEFAULT 0,
  referral_code_changes INTEGER DEFAULT 0,
  referral_status TEXT DEFAULT 'none',
  has_ever_been_pro BOOLEAN DEFAULT FALSE,
  commission_paid BOOLEAN DEFAULT FALSE,
  
  -- Extra columns
  pro_status TEXT DEFAULT 'inactive',
  pro_expiry_date TIMESTAMPTZ,
  referral_code TEXT,
  referral_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create referral_tracking table
CREATE TABLE IF NOT EXISTS public.referral_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code_used TEXT NOT NULL,
  device_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'fraud', 'cancelled')),
  fraud_reason TEXT,
  commission_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_my_referral_code ON public.profiles(my_referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON public.profiles(device_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer ON public.referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referee ON public.referral_tracking(referee_id);

-- 4. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_tracking ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies (to avoid duplicates)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'referral_tracking')) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
  END LOOP;
END $$;

-- 6. RLS Policies for profiles
CREATE POLICY "Allow anon insert for signup" ON public.profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 7. RLS Policies for referral_tracking
CREATE POLICY "Allow anon insert for referral" ON public.referral_tracking
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Referral viewable by everyone" ON public.referral_tracking
  FOR SELECT USING (true);

CREATE POLICY "Users can update own referral" ON public.referral_tracking
  FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- 8. Create trigger function to auto-create profile on signup (SAFE version)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, subscription_status, is_pro,
    device_id, my_referral_code, affiliate_balance,
    referral_code_changes, referral_status, has_ever_been_pro,
    commission_paid, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'FREE',
    FALSE,
    NULL,
    NULL,
    0,
    0,
    'none',
    FALSE,
    FALSE,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 10. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- DONE! Your Supabase is now set up for LuxTrade.
-- New users will automatically get a profile created.
-- ============================================================
