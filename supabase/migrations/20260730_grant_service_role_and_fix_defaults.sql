-- ============================================
-- Migration: Grant service_role ALL on all tables used by admin client
-- Date: 20260730
-- Purpose: Fix permission denied (42501) errors when admin client
--          accesses tables that lacked explicit service_role GRANT.
-- Also: Add DEFAULT gen_random_uuid() to watchlist.id
-- ============================================

-- 1. Grant service_role ALL on all application tables
-- Note: Supabase grants service_role ALL by default at project creation,
-- but these explicit GRANTs ensure they persist across resets.

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'trading_accounts',
    'journal_entries',
    'watchlist',
    'weekly_goals',
    'social_links',
    'tags',
    'promo_codes',
    'affiliates',
    'affiliate_referrals',
    'affiliate_withdrawals',
    'user_subscriptions',
    'community_trades',
    'bug_reports',
    'trading_integrations',
    'notification_preferences',
    'user_achievements',
    'achievements',
    'email_broadcasts',
    'payment_orders',
    'shared_trades',
    'user_submissions',
    'mission_progress',
    'testimonials',
    'profiles',
    'trades'
  ];
BEGIN
  FOR i IN 1..array_length(tables, 1) LOOP
    tbl := tables[i];
    BEGIN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
      RAISE NOTICE '✅ Granted service_role ALL on %', tbl;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '⚠️ Table % does not exist, skipping', tbl;
    END;
  END LOOP;
END;
$$;

-- 2. Fix watchlist.id: ensure database-level DEFAULT exists
-- Prisma's @default(uuid()) is client-side only; raw Supabase inserts
-- need a DB-level default to avoid "null value in column id" error.
DO $$
BEGIN
  -- Check current default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'watchlist'
      AND column_name = 'id'
      AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE public.watchlist ALTER COLUMN id SET DEFAULT gen_random_uuid();
    RAISE NOTICE '✅ Set DEFAULT gen_random_uuid() on watchlist.id';
  ELSE
    RAISE NOTICE 'ℹ️ watchlist.id already has a default, skipping';
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '⚠️ Table watchlist does not exist, skipping id default fix';
END;
$$;

-- 3. Also fix same issue for other tables that might lack id defaults
-- (defensive — these tables are inserted into via raw Supabase JS)
DO $$
DECLARE
  tbl text;
  id_tables text[] := ARRAY[
    'mission_progress',
    'user_submissions',
    'user_achievements',
    'bug_reports',
    'community_trades',
    'notification_preferences',
    'trading_integrations',
    'email_broadcasts',
    'shared_trades',
    'payment_orders'
  ];
  has_default boolean;
BEGIN
  FOR i IN 1..array_length(id_tables, 1) LOOP
    tbl := id_tables[i];
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = tbl
          AND column_name = 'id'
          AND column_default IS NOT NULL
      ) INTO has_default;

      IF NOT has_default THEN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid()', tbl);
        RAISE NOTICE '✅ Set DEFAULT gen_random_uuid() on %.id', tbl;
      ELSE
        RAISE NOTICE 'ℹ️ %.id already has a default, skipping', tbl;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '⚠️ Table % does not exist, skipping', tbl;
    WHEN undefined_column THEN
      RAISE NOTICE '⚠️ Table % has no id column, skipping', tbl;
    END;
  END LOOP;
END;
$$;
