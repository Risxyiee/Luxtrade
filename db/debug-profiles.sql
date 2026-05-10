-- ============================================
-- DEBUG: Check Profiles Table Status
-- ============================================

-- 1. Check if profiles table exists
SELECT
  'Table exists?' as info,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public')
    THEN 'YES'
    ELSE 'NO'
  END as status;

-- 2. Check auth users count
SELECT 'Auth users in database:' as info, COUNT(*) as count FROM auth.users;

-- 3. Check profiles count
SELECT 'Profiles count:' as info, COUNT(*) as count FROM public.profiles;

-- 4. Show auth users data
SELECT 'Auth users sample:' as info, id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 5. Show profiles data (if any)
SELECT 'Profiles sample:' as info, id, email, full_name, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- 6. Check if RLS is enabled
SELECT 'RLS enabled?' as info,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles' AND rowsecurity = true)
    THEN 'YES'
    ELSE 'NO'
  END as status;

-- 7. Check policies
SELECT 'Policies on profiles:' as info, policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'profiles';

-- 8. Check if trigger exists
SELECT 'Trigger exists?' as info,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN 'YES'
    ELSE 'NO'
  END as status;
