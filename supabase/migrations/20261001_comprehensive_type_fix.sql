-- ============================================================================
-- COMPREHENSIVE FIX: Type Mismatches + RLS Policies
-- Date: 2026-10-01
--
-- This single migration fixes ALL the issues:
-- 1. Changes users.id from UUID to TEXT (matching profiles.id)
-- 2. Changes user_subscriptions.id from UUID to TEXT
-- 3. Changes user_subscriptions.user_id from UUID to TEXT
-- 4. Changes prop_firm_challenges.id from UUID to TEXT
-- 5. Changes prop_firm_challenges.user_id from UUID to TEXT
-- 6. Re-points FKs from users(id) to profiles(id)
-- 7. Fixes ALL RLS policies to use auth.uid()::text = user_id
-- ============================================================================

-- ============================================================================
-- PART 1: Fix prop_firm_challenges column types
-- ============================================================================

-- Drop FK constraint on prop_firm_challenges.user_id
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
    RAISE NOTICE 'Dropped FK on prop_firm_challenges.user_id: %', fk_constraint;
  END IF;
END;
$$;

-- Change prop_firm_challenges.user_id: UUID → TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prop_firm_challenges'
      AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.prop_firm_challenges ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    RAISE NOTICE 'prop_firm_challenges.user_id: UUID → TEXT';
  END IF;
END;
$$;

-- Change prop_firm_challenges.id: UUID → TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prop_firm_challenges'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.prop_firm_challenges ALTER COLUMN id TYPE TEXT USING id::text;
    RAISE NOTICE 'prop_firm_challenges.id: UUID → TEXT';
  END IF;
END;
$$;

-- Re-add FK: prop_firm_challenges.user_id → profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'prop_firm_challenges' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.prop_firm_challenges
      ADD CONSTRAINT fk_prop_firm_challenges_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: prop_firm_challenges.user_id → profiles(id)';
  END IF;
END;
$$;

-- ============================================================================
-- PART 2: Fix user_subscriptions column types
-- ============================================================================

-- Drop FK on user_subscriptions.user_id
DO $$
DECLARE
  fk_constraint text;
BEGIN
  SELECT tc.constraint_name INTO fk_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
  WHERE tc.table_name = 'user_subscriptions' AND tc.table_schema = 'public'
    AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY';

  IF fk_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_subscriptions DROP CONSTRAINT %I', fk_constraint);
    RAISE NOTICE 'Dropped FK on user_subscriptions.user_id: %', fk_constraint;
  END IF;
END;
$$;

-- Change user_subscriptions.user_id: UUID → TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
      AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.user_subscriptions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    RAISE NOTICE 'user_subscriptions.user_id: UUID → TEXT';
  END IF;
END;
$$;

-- Change user_subscriptions.id: UUID → TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.user_subscriptions ALTER COLUMN id TYPE TEXT USING id::text;
    RAISE NOTICE 'user_subscriptions.id: UUID → TEXT';
  END IF;
END;
$$;

-- Re-add FK: user_subscriptions.user_id → profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'user_subscriptions' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT fk_user_subscriptions_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: user_subscriptions.user_id → profiles(id)';
  END IF;
END;
$$;

-- ============================================================================
-- PART 3: Fix users.id type (UUID → TEXT to match profiles.id)
-- ============================================================================

-- Drop FKs that reference users.id first
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.constraint_column_usage ccu2
      ON tc.constraint_name = ccu2.constraint_name AND tc.table_schema = ccu2.table_schema
    WHERE ccu2.table_name = 'users' AND ccu2.column_name = 'id'
      AND tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name != 'user_subscriptions' -- already handled above
      AND tc.table_name != 'prop_firm_challenges' -- already handled above
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    RAISE NOTICE 'Dropped FK % on %', rec.constraint_name, rec.table_name;
  END LOOP;
END;
$$;

-- Change users.id: UUID → TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN id TYPE TEXT USING id::text;
    RAISE NOTICE 'users.id: UUID → TEXT';
  END IF;
END;
$$;

-- ============================================================================
-- PART 4: Fix ALL RLS policies — auth.uid()::text = user_id
-- ============================================================================

-- Helper function to fix RLS for a table
-- (We use inline DO blocks for each table since dynamic SQL in PL/pgSQL
--  doesn't support creating policies via EXECUTE easily)

-- 4a. trades
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own trades" ON public.trades';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own trades" ON public.trades';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades';
  EXECUTE 'CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for trades';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error trades RLS: %', SQLERRM;
END $$;

-- 4b. trading_accounts
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own trading accounts" ON public.trading_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own trading accounts" ON public.trading_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own trading accounts" ON public.trading_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own trading accounts" ON public.trading_accounts';
  EXECUTE 'CREATE POLICY "Users can view own trading accounts" ON public.trading_accounts FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own trading accounts" ON public.trading_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own trading accounts" ON public.trading_accounts FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own trading accounts" ON public.trading_accounts FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for trading_accounts';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error trading_accounts RLS: %', SQLERRM;
END $$;

-- 4c. journal_entries
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own journals" ON public.journal_entries';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own journals" ON public.journal_entries';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own journals" ON public.journal_entries';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own journals" ON public.journal_entries';
  EXECUTE 'CREATE POLICY "Users can view own journals" ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own journals" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own journals" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own journals" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for journal_entries';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error journal_entries RLS: %', SQLERRM;
END $$;

-- 4d. watchlist
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own watchlist" ON public.watchlist';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own watchlist" ON public.watchlist';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own watchlist" ON public.watchlist';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own watchlist" ON public.watchlist';
  EXECUTE 'CREATE POLICY "Users can view own watchlist" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own watchlist" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own watchlist" ON public.watchlist FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own watchlist" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for watchlist';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error watchlist RLS: %', SQLERRM;
END $$;

-- 4e. user_subscriptions
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.user_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.user_subscriptions';
  EXECUTE 'CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own subscriptions" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own subscriptions" ON public.user_subscriptions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own subscriptions" ON public.user_subscriptions FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for user_subscriptions';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error user_subscriptions RLS: %', SQLERRM;
END $$;

-- 4f. prop_firm_challenges
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'CREATE POLICY "Users can view own prop firm challenges" ON public.prop_firm_challenges FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own prop firm challenges" ON public.prop_firm_challenges FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own prop firm challenges" ON public.prop_firm_challenges FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own prop firm challenges" ON public.prop_firm_challenges FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for prop_firm_challenges';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error prop_firm_challenges RLS: %', SQLERRM;
END $$;

-- 4g. tags
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own tags" ON public.tags';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own tags" ON public.tags';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own tags" ON public.tags';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags';
  EXECUTE 'CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for tags';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error tags RLS: %', SQLERRM;
END $$;

-- 4h. weekly_goals
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own weekly goals" ON public.weekly_goals';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own weekly goals" ON public.weekly_goals';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own weekly goals" ON public.weekly_goals';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own weekly goals" ON public.weekly_goals';
  EXECUTE 'CREATE POLICY "Users can view own weekly goals" ON public.weekly_goals FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own weekly goals" ON public.weekly_goals FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own weekly goals" ON public.weekly_goals FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own weekly goals" ON public.weekly_goals FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for weekly_goals';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error weekly_goals RLS: %', SQLERRM;
END $$;

-- 4i. social_links
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own social links" ON public.social_links';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own social links" ON public.social_links';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own social links" ON public.social_links';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own social links" ON public.social_links';
  EXECUTE 'CREATE POLICY "Users can view own social links" ON public.social_links FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own social links" ON public.social_links FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own social links" ON public.social_links FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own social links" ON public.social_links FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for social_links';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error social_links RLS: %', SQLERRM;
END $$;

-- 4j. payment_orders
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own payment orders" ON public.payment_orders';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own payment orders" ON public.payment_orders';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own payment orders" ON public.payment_orders';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own payment orders" ON public.payment_orders';
  EXECUTE 'CREATE POLICY "Users can view own payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own payment orders" ON public.payment_orders FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own payment orders" ON public.payment_orders FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own payment orders" ON public.payment_orders FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS for payment_orders';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error payment_orders RLS: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 5: Ensure service_role has ALL on tables used by admin API
-- ============================================================================

GRANT ALL ON TABLE public.prop_firm_challenges TO service_role;
GRANT ALL ON TABLE public.user_subscriptions TO service_role;
GRANT ALL ON TABLE public.trades TO service_role;
GRANT ALL ON TABLE public.trading_accounts TO service_role;
GRANT ALL ON TABLE public.journal_entries TO service_role;
GRANT ALL ON TABLE public.watchlist TO service_role;

-- ============================================================================
-- DONE
-- ============================================================================
-- Run this SQL in Supabase SQL Editor, then:
-- 1. Clear KV cache: hit /api/news?refresh=true
-- 2. Test: edit a prop firm challenge → all fields should save
-- 3. Test: add a trade → should save successfully
-- 4. Test: watchlist prices should show real-time values
-- ============================================================================
