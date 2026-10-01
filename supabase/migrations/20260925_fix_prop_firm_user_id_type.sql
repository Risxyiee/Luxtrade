-- ============================================
-- Migration: Fix prop_firm_challenges.user_id type from UUID to TEXT
-- Date: 2026-09-25
-- Purpose: The Prisma schema defines user_id as String (TEXT), but the
--          actual DB column was created as UUID (referencing auth.users.id).
--          This causes a type mismatch: Supabase service_role admin queries
--          work (bypass RLS), but the UUID column can't store TEXT user_ids
--          that don't match UUID format, and existing rows may have UUIDs
--          that don't match the TEXT profiles.id values.
--
--          The profiles table uses TEXT for id. This migration aligns
--          prop_firm_challenges.user_id to TEXT so it matches profiles.id
--          and avoids type casting issues with auth.uid()::text comparisons.
-- ============================================

-- Step 1: Drop the foreign key constraint if it exists (references auth.users)
DO $$
DECLARE
  fk_constraint text;
BEGIN
  SELECT tc.constraint_name INTO fk_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.table_name = 'prop_firm_challenges'
    AND tc.table_schema = 'public'
    AND ccu.column_name = 'user_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF fk_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.prop_firm_challenges DROP CONSTRAINT %I', fk_constraint);
    RAISE NOTICE 'Dropped FK constraint: %', fk_constraint;
  ELSE
    RAISE NOTICE 'No FK constraint on user_id found, skipping drop';
  END IF;
END;
$$;

-- Step 2: Alter the column type from UUID to TEXT
-- This preserves existing data (UUIDs are valid TEXT) and allows new TEXT ids.
DO $$
BEGIN
  -- Check current data type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prop_firm_challenges'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.prop_firm_challenges
      ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    RAISE NOTICE 'Changed user_id from UUID to TEXT';
  ELSE
    RAISE NOTICE 'user_id is already TEXT, skipping type change';
  END IF;
END;
$$;

-- Step 3: Re-add a foreign key to profiles.id (TEXT) instead of auth.users (UUID)
-- This ensures referential integrity with our actual profiles table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'prop_firm_challenges'
      AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.prop_firm_challenges
      ADD CONSTRAINT fk_prop_firm_challenges_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
    RAISE NOTICE 'Added FK to profiles(id)';
  ELSE
    RAISE NOTICE 'FK already exists, skipping';
  END IF;
END;
$$;

-- Step 4: Ensure service_role has ALL on prop_firm_challenges (admin API uses it)
GRANT ALL ON TABLE public.prop_firm_challenges TO service_role;

-- Step 5: Ensure prop_firm_challenges has proper id default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prop_firm_challenges'
      AND column_name = 'id'
      AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE public.prop_firm_challenges ALTER COLUMN id SET DEFAULT gen_random_uuid();
    RAISE NOTICE 'Set DEFAULT gen_random_uuid() on prop_firm_challenges.id';
  ELSE
    RAISE NOTICE 'id already has a default, skipping';
  END IF;
END;
$$;
