-- ============================================================================
-- Migration: Fix RLS for push_subscriptions table
-- Date: 2026-10-13
-- Bug: BUG 3 — Push notifications not appearing on mobile because
--       push_subscriptions table had no RLS policies, causing Supabase
--       lint warnings and potential security issues.
--
-- The push_subscriptions table was created by Prisma db:push but never
-- had RLS enabled or policies defined. This migration:
--   1. Enables RLS on push_subscriptions
--   2. Creates policies so users can only CRUD their own subscriptions
--   3. Revokes anon access (push subscriptions require authentication)
--   4. Grants service_role full access (used by server-side API routes)
-- ============================================================================

-- ===== 1. Enable RLS on push_subscriptions =====
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ===== 2. Revoke all anon access =====
-- Push subscriptions should NEVER be accessible by anonymous users.
REVOKE ALL ON TABLE public.push_subscriptions FROM anon;

-- ===== 3. Create RLS policies for authenticated users =====
-- Users can only see and manage their OWN push subscriptions.
-- The user_id column is TEXT (Clerk user ID), so we use auth.uid()::text.

DO $$ BEGIN
  -- SELECT: Users can view their own subscriptions
  EXECUTE 'CREATE POLICY "Users can view own push subscriptions"
    ON public.push_subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid()::text = user_id)';

  -- INSERT: Users can create their own subscriptions (from browser subscribe flow)
  EXECUTE 'CREATE POLICY "Users can insert own push subscriptions"
    ON public.push_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = user_id)';

  -- UPDATE: Users can update their own subscriptions (e.g., refresh keys)
  EXECUTE 'CREATE POLICY "Users can update own push subscriptions"
    ON public.push_subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = user_id)';

  -- DELETE: Users can delete their own subscriptions (unsubscribe flow)
  EXECUTE 'CREATE POLICY "Users can delete own push subscriptions"
    ON public.push_subscriptions FOR DELETE
    TO authenticated
    USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Created RLS policies for push_subscriptions with auth.uid()::text cast';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating push_subscriptions RLS policies: %', SQLERRM;
END $$;

-- ===== 4. Grant authenticated role access =====
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- ===== 5. Grant service_role full access =====
-- Server-side API routes (Prisma) use the service_role which bypasses RLS,
-- but we still need table-level permissions for direct PostgREST access.
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

-- ===== Verification =====
DO $$ BEGIN
  RAISE NOTICE '===== push_subscriptions RLS Migration Verification =====';

  -- Check RLS is enabled
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'push_subscriptions'
      AND schemaname = 'public'
      AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS enabled on push_subscriptions';
  ELSE
    RAISE NOTICE '❌ RLS NOT enabled on push_subscriptions';
  END IF;

  -- Check policies exist
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions'
      AND policyname = 'Users can view own push subscriptions'
  ) THEN
    RAISE NOTICE '✅ SELECT RLS policy exists';
  ELSE
    RAISE NOTICE '❌ SELECT RLS policy MISSING';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions'
      AND policyname = 'Users can insert own push subscriptions'
  ) THEN
    RAISE NOTICE '✅ INSERT RLS policy exists';
  ELSE
    RAISE NOTICE '❌ INSERT RLS policy MISSING';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions'
      AND policyname = 'Users can delete own push subscriptions'
  ) THEN
    RAISE NOTICE '✅ DELETE RLS policy exists';
  ELSE
    RAISE NOTICE '❌ DELETE RLS policy MISSING';
  END IF;

  RAISE NOTICE '===== Verification Complete =====';
END $$;
