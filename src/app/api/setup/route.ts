import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// One-time setup script for LuxTrade
// Run this endpoint to check database status

// Admin emails
const ADMIN_EMAILS = ['luxtradee@gmail.com']

// Full SQL setup script - INCLUDES nuclear option to drop ALL triggers
const SETUP_SQL = `-- ============================================================
-- LuxTrade Supabase Database Setup
-- Run this in Supabase SQL Editor
-- ============================================================

-- 0. NUCLEAR OPTION: Drop ALL triggers on auth.users (fixes broken triggers)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_table = 'users' AND trigger_schema = 'auth') LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS "' || r.trigger_name || '" ON auth.users';
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;

-- Also drop any functions that might be broken
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
  device_id TEXT,
  my_referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  affiliate_balance INTEGER DEFAULT 0,
  referral_code_changes INTEGER DEFAULT 0,
  referral_status TEXT DEFAULT 'none',
  has_ever_been_pro BOOLEAN DEFAULT FALSE,
  commission_paid BOOLEAN DEFAULT FALSE,
  pro_status TEXT DEFAULT 'inactive',
  pro_expiry_date TIMESTAMPTZ,
  referral_code TEXT,
  referral_count INTEGER DEFAULT 0,
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
  status TEXT DEFAULT 'pending',
  fraud_reason TEXT,
  commission_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_my_referral_code ON public.profiles(my_referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON public.profiles(device_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer ON public.referral_tracking(referrer_id);

-- 4. Enable RLS
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
CREATE POLICY "Allow anon insert for signup" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 7. RLS Policies for referral_tracking
CREATE POLICY "Allow anon insert for referral" ON public.referral_tracking FOR INSERT WITH CHECK (true);
CREATE POLICY "Referral viewable by everyone" ON public.referral_tracking FOR SELECT USING (true);
CREATE POLICY "Users can update own referral" ON public.referral_tracking FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- 8. Auto-create profile trigger (SAFE version - only inserts basic columns)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, subscription_status, is_pro, device_id, my_referral_code, affiliate_balance, referral_code_changes, referral_status, has_ever_been_pro, commission_paid, created_at, updated_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 'FREE', FALSE, NULL, NULL, 0, 0, 'none', FALSE, FALSE, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 9. Auto-update updated_at trigger
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

-- DONE! Your Supabase is ready for LuxTrade.`

// SQL to ONLY drop all triggers (emergency fix)
const EMERGENCY_DROP_SQL = `-- Emergency: Drop ALL triggers on auth.users
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'users' AND trigger_schema = 'auth') LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS "' || r.trigger_name || '" ON auth.users';
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
-- After this, registration will work but profiles won't auto-create.
-- Then run the full setup.sql to recreate with correct trigger.`

export async function GET() {
  const results = {
    success: false,
    checks: [] as { name: string; status: 'ok' | 'error' | 'warning'; message: string }[],
    errors: [] as string[],
    sql: SETUP_SQL,
    emergencySql: EMERGENCY_DROP_SQL,
    profiles: [] as unknown,
  }

  try {
    // Use the same anon client as the rest of the app
    // Check 1: profiles table
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      if (error) {
        const msg = error.message || String(error)
        if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
          results.checks.push({
            name: 'Profiles Table',
            status: 'error',
            message: 'Table "profiles" does NOT exist. Run the SQL below.'
          })
        } else {
          results.checks.push({
            name: 'Profiles Table',
            status: 'warning',
            message: `Query error: ${msg}`
          })
        }
      } else {
        results.checks.push({
          name: 'Profiles Table',
          status: 'ok',
          message: 'Profiles table exists and is accessible'
        })
      }
    } catch (e) {
      results.checks.push({
        name: 'Profiles Table',
        status: 'error',
        message: `Failed: ${e}`
      })
    }

    // Check 2: referral_tracking table
    try {
      const { error } = await supabase.from('referral_tracking').select('id').limit(1)
      if (error) {
        const msg = error.message || String(error)
        if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
          results.checks.push({
            name: 'Referral Tracking Table',
            status: 'error',
            message: 'Table "referral_tracking" does NOT exist. Run the SQL below.'
          })
        } else {
          results.checks.push({
            name: 'Referral Tracking Table',
            status: 'warning',
            message: `Query error: ${msg}`
          })
        }
      } else {
        results.checks.push({
          name: 'Referral Tracking Table',
          status: 'ok',
          message: 'Referral tracking table exists'
        })
      }
    } catch (e) {
      results.checks.push({
        name: 'Referral Tracking Table',
        status: 'error',
        message: `Failed: ${e}`
      })
    }

    // Check 3: Get existing profiles
    try {
      const { data: existingProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, subscription_status, is_pro, my_referral_code')

      if (profilesError) {
        results.checks.push({
          name: 'Profiles Data',
          status: 'error',
          message: profilesError.message
        })
      } else {
        results.checks.push({
          name: 'Profiles Data',
          status: 'ok',
          message: `Found ${existingProfiles?.length || 0} profiles`
        })
        results.profiles = existingProfiles
      }
    } catch {
      // skip
    }

    // Check 4: Test signup flow (dry-run)
    results.checks.push({
      name: 'Registration Test',
      status: 'warning',
      message: 'Cannot test signup from server. Try registering a new account to verify.'
    })

    results.success = results.errors.length === 0
    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    results.errors.push(`Unexpected error: ${error}`)
    return NextResponse.json(results, { status: 500 })
  }
}

// POST to trigger setup checks
export async function POST() {
  const results = {
    success: false,
    actions: [] as string[],
    errors: [] as string[],
  }

  try {
    // Use anon client to check profiles
    const { error } = await supabase.from('profiles').select('id').limit(1)

    if (error) {
      const msg = error.message || String(error)
      if (msg.includes('does not exist')) {
        results.actions.push('❌ Profiles table does not exist')
        results.errors.push('Run the SQL from /api/setup in Supabase SQL Editor')
      } else {
        results.actions.push('⚠️ Profiles table error: ' + msg)
      }
    } else {
      results.actions.push('✅ Profiles table exists and accessible')
      
      // Try to count profiles
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      
      results.actions.push(`📊 Found ${count || 0} profiles`)
    }

    // Check referral_tracking
    const { error: refError } = await supabase.from('referral_tracking').select('id').limit(1)
    if (refError) {
      const msg = refError.message || String(refError)
      if (msg.includes('does not exist')) {
        results.actions.push('❌ Referral tracking table does not exist')
        results.errors.push('Run the SQL from /api/setup in Supabase SQL Editor')
      }
    } else {
      results.actions.push('✅ Referral tracking table exists')
    }

    results.success = results.errors.length === 0

    if (results.success) {
      results.actions.push('')
      results.actions.push('🎉 Database is ready! Try registering a new account.')
    } else {
      results.actions.push('')
      results.actions.push('⚠️ Database needs setup. Run the SQL from supabase/setup.sql in Supabase Dashboard → SQL Editor.')
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    results.errors.push(`Unexpected error: ${error}`)
    return NextResponse.json(results, { status: 500 })
  }
}
