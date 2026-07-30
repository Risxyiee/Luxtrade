-- ============================================
-- Fix: promo_codes permission denied for service_role/postgrest
-- Run this in Supabase SQL Editor
-- ============================================

-- The issue: PostgREST connects as "authenticator" role,
-- which is NOT covered by "anon" or "authenticated" policies.
-- Fix: add explicit GRANT to authenticator role.

-- Add policy for authenticator role (used by PostgREST)
DO $$ BEGIN
  IF to_regclass('public.promo_codes') IS NOT NULL THEN
    -- Drop existing if any
    EXECUTE 'DROP POLICY IF EXISTS "promo_codes_service_role_read" ON public.promo_codes';
    -- Create policy for ALL roles including service_role
    EXECUTE 'CREATE POLICY "promo_codes_service_role_read" ON public.promo_codes FOR SELECT TO service_role, authenticator USING (true)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Also ensure grants exist for all relevant roles
DO $$ BEGIN
  IF to_regclass('public.promo_codes') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.promo_codes TO authenticator';
    EXECUTE 'GRANT ALL ON public.promo_codes TO service_role';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
