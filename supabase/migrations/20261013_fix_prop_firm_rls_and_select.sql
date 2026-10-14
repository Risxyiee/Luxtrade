-- ============================================================================
-- Migration: Fix prop_firm_challenges RLS policies and ensure complete select coverage
-- Date: 2026-10-13
-- Bug: "PropFirm Guard akun tidak bisa di-edit"
--
-- Root Causes Fixed:
--   1. RLS may not be enabled on prop_firm_challenges — without ENABLE ROW LEVEL SECURITY,
--      policies are inert. This migration ensures RLS is enabled.
--   2. UPDATE policy was missing WITH CHECK clause — without it, an authenticated user
--      who passes the USING check could change user_id to another user's ID.
--   3. INSERT policy was already correct (WITH CHECK), but we drop and recreate all 4
--      policies for consistency and to guarantee the WITH CHECK is present on both
--      INSERT and UPDATE.
--   4. Grant service_role ALL access explicitly (defense-in-depth for admin API routes
--      that use the service_role client which bypasses RLS).
-- ============================================================================

-- Step 1: Ensure RLS is enabled on prop_firm_challenges
ALTER TABLE public.prop_firm_challenges ENABLE ROW LEVEL SECURITY;

-- Step 2: Revoke all anon access (anon should never CRUD prop firm challenges)
REVOKE ALL ON TABLE public.prop_firm_challenges FROM anon;

-- Step 3: Drop existing policies so we can recreate with WITH CHECK clauses
-- We must drop before creating because CREATE OR REPLACE doesn't work for RLS policies
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own prop firm challenges" ON public.prop_firm_challenges';

  -- Also drop older policy names that may exist from earlier migrations
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own challenges" ON public.prop_firm_challenges';

  RAISE NOTICE 'Dropped existing prop_firm_challenges RLS policies';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping prop_firm_challenges policies: %', SQLERRM;
END $$;

-- Step 4: Recreate all 4 policies WITH proper WITH CHECK on INSERT and UPDATE
-- Using auth.uid()::text because user_id is TEXT (after 20260925 migration)

-- SELECT: users can only see their own challenges
CREATE POLICY "Users can view own prop firm challenges"
  ON public.prop_firm_challenges FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

-- INSERT: users can only insert rows with their own user_id
-- WITH CHECK ensures the inserted row's user_id matches the authenticated user
CREATE POLICY "Users can insert own prop firm challenges"
  ON public.prop_firm_challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- UPDATE: users can only update their own challenges
-- USING controls which rows are visible for UPDATE
-- WITH CHECK ensures the updated row's user_id cannot be changed to another user
CREATE POLICY "Users can update own prop firm challenges"
  ON public.prop_firm_challenges FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- DELETE: users can only delete their own challenges
CREATE POLICY "Users can delete own prop firm challenges"
  ON public.prop_firm_challenges FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Step 5: Grant authenticated role proper access
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.prop_firm_challenges TO authenticated;

-- Step 6: Explicitly grant service_role ALL access
-- service_role bypasses RLS, but needs table-level permissions for admin API routes
GRANT ALL ON TABLE public.prop_firm_challenges TO service_role;
