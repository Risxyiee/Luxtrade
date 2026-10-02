-- ============================================================================
-- Migration: Add onboarding_steps column to profiles + Fix RLS for onboarding tables
-- Date: 2026-10-02
-- Purpose:
--   1. Add onboarding_steps JSONB column to profiles table
--      (stores array of completed step IDs for the interactive onboarding checklist)
--   2. Ensure user_submissions and mission_progress RLS policies use auth.uid()::text
--      (these were listed in the header of 20261001 migration but the actual
--       DROP/CREATE policy blocks were missing)
-- ============================================================================

-- ===== 1. Add onboarding_steps column to profiles =====
DO $$ BEGIN
  -- Add the column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'onboarding_steps'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_steps JSONB DEFAULT '[]';
    RAISE NOTICE 'Added onboarding_steps column to profiles';
  ELSE
    RAISE NOTICE 'onboarding_steps column already exists in profiles';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding onboarding_steps: %', SQLERRM;
END $$;

-- ===== 2. Fix RLS policies for user_submissions (TEXT user_id) =====
-- These were listed in the 20261001 migration header but the actual
-- policy DROP/CREATE blocks were never included!
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own submissions" ON public.user_submissions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own submissions" ON public.user_submissions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own submissions" ON public.user_submissions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own submissions" ON public.user_submissions';

  EXECUTE 'CREATE POLICY "Users can view own submissions" ON public.user_submissions FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own submissions" ON public.user_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own submissions" ON public.user_submissions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own submissions" ON public.user_submissions FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for user_submissions with auth.uid()::text cast';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing user_submissions RLS: %', SQLERRM;
END $$;

-- ===== 3. Fix RLS policies for mission_progress (TEXT user_id) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own mission progress" ON public.mission_progress';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own mission progress" ON public.mission_progress';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own mission progress" ON public.mission_progress';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own mission progress" ON public.mission_progress';

  EXECUTE 'CREATE POLICY "Users can view own mission progress" ON public.mission_progress FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own mission progress" ON public.mission_progress FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own mission progress" ON public.mission_progress FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own mission progress" ON public.mission_progress FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for mission_progress with auth.uid()::text cast';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing mission_progress RLS: %', SQLERRM;
END $$;

-- ===== 4. Fix V6 migration typo: user_submission → user_submissions =====
-- The V6 migration had `ALTER TABLE public.user_submission` (missing 's')
-- This would have silently failed due to the exception handler, so the FK was never added.
-- Let's add it now if it doesn't exist.
DO $$ BEGIN
  -- First check if the FK constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'user_submissions'
      AND tc.table_schema = 'public'
      AND tc.constraint_name = 'fk_user_submissions_user_id'
  ) THEN
    ALTER TABLE public.user_submissions ADD CONSTRAINT fk_user_submissions_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: user_submissions.user_id → profiles(id)';
  ELSE
    RAISE NOTICE 'FK fk_user_submissions_user_id already exists';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skip FK user_submissions: %', SQLERRM;
END $$;

-- ===== 5. Ensure service_role grants exist for onboarding tables =====
DO $$ BEGIN
  EXECUTE 'GRANT ALL ON TABLE public.user_submissions TO service_role';
  EXECUTE 'GRANT ALL ON TABLE public.mission_progress TO service_role';
  RAISE NOTICE 'Granted service_role access on user_submissions and mission_progress';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error granting service_role: %', SQLERRM;
END $$;

-- ===== Verification =====
DO $$ BEGIN
  RAISE NOTICE '===== Migration Verification =====';

  -- Check onboarding_steps column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'onboarding_steps'
  ) THEN
    RAISE NOTICE '✅ profiles.onboarding_steps column exists';
  ELSE
    RAISE NOTICE '❌ profiles.onboarding_steps column MISSING';
  END IF;

  -- Check user_submissions RLS policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_submissions' AND policyname = 'Users can insert own submissions'
  ) THEN
    RAISE NOTICE '✅ user_submissions INSERT RLS policy exists';
  ELSE
    RAISE NOTICE '❌ user_submissions INSERT RLS policy MISSING';
  END IF;

  -- Check mission_progress RLS policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mission_progress' AND policyname = 'Users can insert own mission progress'
  ) THEN
    RAISE NOTICE '✅ mission_progress INSERT RLS policy exists';
  ELSE
    RAISE NOTICE '❌ mission_progress INSERT RLS policy MISSING';
  END IF;

  RAISE NOTICE '===== Verification Complete =====';
END $$;
