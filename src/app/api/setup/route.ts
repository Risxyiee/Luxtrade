import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// One-time setup script for LuxTrade
// Run this endpoint to check database status and get setup instructions

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://biqtkulvmqtikflcmqad.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Admin emails to auto-upgrade to PRO
const ADMIN_EMAILS = ['luxtradee@gmail.com']

// Full SQL setup script
const SETUP_SQL = `-- ============================================================
-- LuxTrade Supabase Database Setup
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Drop existing triggers that may cause errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- 2. Create profiles table with ALL required columns
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

-- 3. Create referral_tracking table
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

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_my_referral_code ON public.profiles(my_referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON public.profiles(device_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer ON public.referral_tracking(referrer_id);

-- 5. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_tracking ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies (to avoid duplicates)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'referral_tracking')) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
  END LOOP;
END $$;

-- 7. RLS Policies for profiles
CREATE POLICY "Allow anon insert for signup" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 8. RLS Policies for referral_tracking
CREATE POLICY "Allow anon insert for referral" ON public.referral_tracking FOR INSERT WITH CHECK (true);
CREATE POLICY "Referral viewable by everyone" ON public.referral_tracking FOR SELECT USING (true);
CREATE POLICY "Users can update own referral" ON public.referral_tracking FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- 9. Auto-create profile trigger
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

-- 10. Auto-update updated_at trigger
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

export async function GET() {
  const results = {
    success: false,
    checks: [] as { name: string; status: 'ok' | 'error' | 'warning'; message: string }[],
    errors: [] as string[],
    sql: SETUP_SQL,
    users: [] as unknown,
    profiles: [] as unknown,
  }

  try {
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check 1: Can we connect?
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      if (error) {
        const msg = error.message || String(error)
        if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
          results.checks.push({
            name: 'Profiles Table',
            status: 'error',
            message: 'Table "profiles" does not exist. Run the SQL below to create it.'
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
          message: 'Profiles table exists'
        })
      }
    } catch (e) {
      results.checks.push({
        name: 'Profiles Table',
        status: 'error',
        message: `Failed to check: ${e}`
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
            message: 'Table "referral_tracking" does not exist. Run the SQL below to create it.'
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
        message: `Failed to check: ${e}`
      })
    }

    // Check 3: Try to list auth users
    try {
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
      if (usersError) {
        results.checks.push({
          name: 'Auth Users',
          status: 'warning',
          message: `Cannot list users (service role key needed): ${usersError.message}`
        })
      } else {
        results.checks.push({
          name: 'Auth Users',
          status: 'ok',
          message: `Found ${users.length} registered users`
        })
        results.users = users.map((u: { id: string; email: string | null; created_at: string }) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at
        }))
      }
    } catch (e) {
      results.checks.push({
        name: 'Auth Users',
        status: 'warning',
        message: `Cannot list users (anon key used): Need service role key`
      })
    }

    // Check 4: Get existing profiles
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
    } catch (e) {
      // skip
    }

    results.success = results.errors.length === 0

    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    results.errors.push(`Unexpected error: ${error}`)
    return NextResponse.json(results, { status: 500 })
  }
}

// POST to trigger setup checks and auto-create profiles for existing users
export async function POST() {
  const results = {
    success: false,
    actions: [] as string[],
    errors: [] as string[],
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Try to get all auth users
    try {
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

      if (usersError) {
        results.actions.push('⚠️ Cannot list users - need SUPABASE_SERVICE_ROLE_KEY')
        results.errors.push(usersError.message)
      } else if (users && users.length > 0) {
        results.actions.push(`Found ${users.length} users in auth`)

        // Get existing profiles
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id')

        const profileMap = new Map(
          (existingProfiles || []).map((p: { id: string }) => [p.id, true])
        )

        // Create profiles for users who don't have one
        for (const user of users) {
          if (!profileMap.has(user.id)) {
            const isAdmin = ADMIN_EMAILS.includes(user.email || '')

            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
                subscription_status: isAdmin ? 'PRO' : 'FREE',
                is_pro: isAdmin,
                my_referral_code: `LUX${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })

            if (insertError) {
              results.errors.push(`Profile for ${user.email}: ${insertError.message}`)
            } else {
              results.actions.push(`Created profile for ${user.email}${isAdmin ? ' (PRO)' : ''}`)
            }
          }
        }

        // Upgrade admin users
        for (const adminEmail of ADMIN_EMAILS) {
          const adminUser = users.find((u: { email: string | null }) => u.email === adminEmail)
          if (adminUser) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: 'PRO',
                is_pro: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', adminUser.id)

            if (updateError) {
              results.errors.push(`Admin upgrade failed: ${updateError.message}`)
            } else {
              results.actions.push(`👑 Upgraded ${adminEmail} to PRO`)
            }
          }
        }
      }
    } catch (e) {
      results.actions.push('⚠️ Service role key not available - cannot auto-create profiles')
    }

    results.success = results.errors.length === 0
    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    results.errors.push(`Unexpected error: ${error}`)
    return NextResponse.json(results, { status: 500 })
  }
}
