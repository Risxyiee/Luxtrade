-- ============================================
-- DIRECT POPULATE PROFILES FROM AUTH.USERS
-- ============================================
-- Run this in Supabase SQL Editor

-- Step 1: Check auth.users count
SELECT 'Auth users count:' as info, COUNT(*) as count FROM auth.users;

-- Step 2: Check current profiles count
SELECT 'Profiles count:' as info, COUNT(*) as count FROM public.profiles;

-- Step 3: Insert all auth users into profiles (skipping duplicates)
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
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name'
  ) as full_name,
  'FREE'::text as subscription_status,
  false as is_pro,
  NULL::timestamptz as subscription_until,
  'inactive'::text as pro_status,
  NULL::timestamptz as pro_expiry_date,
  0 as affiliate_balance,
  0 as referral_count,
  false as commission_paid,
  false as has_ever_been_pro,
  NULL::text as device_id,
  NULL::text as my_referral_code,
  u.raw_user_meta_data->>'referral_code' as referred_by_code,
  2 as referral_code_changes,
  NULL::text as referral_status,
  COALESCE(u.created_at, NOW()) as created_at,
  NOW() as updated_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Step 4: Show result
SELECT 'Profiles after insert:' as info, COUNT(*) as count FROM public.profiles;

-- Step 5: Show sample data
SELECT id, email, full_name, subscription_status, is_pro, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;
