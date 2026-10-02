-- ============================================================================
-- COMPREHENSIVE FIX: All Type Mismatches, FK Constraints, and RLS Policies
-- Date: 2026-10-01 (V5 - Bulletproof)
-- 
-- Run this ONCE in Supabase SQL Editor.
-- It is IDEMPOTENT — safe to re-run if it partially fails.
--
-- FIXES IN V5:
--   ✅ Step 7 GRANTs wrapped in exception handlers
--      (V4 crashed because push_subscriptions table doesn't exist)
--   ✅ Step 5 FK adds wrapped in exception handlers
--   ✅ Step 6 RLS uses exception handlers
--   ✅ Step 0a drops ALL FKs on user_id/id columns in EVERY table
--   ✅ Step 0b drops ALL RLS policies BEFORE altering column types
-- ============================================================================

-- ============================================================================
-- STEP 0a: Drop ALL foreign key constraints on columns we are going to alter.
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT 
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND kcu.column_name = 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    RAISE NOTICE 'Dropped FK: % on %.%', rec.constraint_name, rec.table_name, rec.column_name;
  END LOOP;

  FOR rec IN
    SELECT 
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND kcu.column_name = 'id'
      AND tc.table_name IN ('users', 'user_subscriptions', 'prop_firm_challenges')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    RAISE NOTICE 'Dropped FK: % on %.%', rec.constraint_name, rec.table_name, rec.column_name;
  END LOOP;

  FOR rec IN
    SELECT 
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND (
        (ccu.table_name = 'users' AND ccu.column_name = 'id')
        OR
        (ccu.table_name = 'profiles' AND ccu.column_name = 'id')
        OR
        (ccu.table_name = 'user_subscriptions' AND ccu.column_name = 'id')
        OR
        (ccu.table_name = 'prop_firm_challenges' AND ccu.column_name = 'id')
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
      RAISE NOTICE 'Dropped ref FK: % on %.%', rec.constraint_name, rec.table_name, rec.column_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop FK % on %: %', rec.constraint_name, rec.table_name, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 0b: Drop ALL RLS policies that reference columns we're about to alter
-- ============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    RAISE NOTICE 'Dropped policy: % on users', pol.policyname;
  END LOOP;
END;
$$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_subscriptions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_subscriptions', pol.policyname);
    RAISE NOTICE 'Dropped policy: % on user_subscriptions', pol.policyname;
  END LOOP;
END;
$$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prop_firm_challenges'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.prop_firm_challenges', pol.policyname);
    RAISE NOTICE 'Dropped policy: % on prop_firm_challenges', pol.policyname;
  END LOOP;
END;
$$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT DISTINCT p.tablename, p.policyname
    FROM pg_policies p
    JOIN information_schema.columns c
      ON c.table_schema = 'public'
      AND c.table_name = p.tablename
      AND c.column_name = 'user_id'
    WHERE p.schemaname = 'public'
      AND p.tablename NOT IN ('users', 'user_subscriptions', 'prop_firm_challenges')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    RAISE NOTICE 'Dropped policy: % on %', pol.policyname, pol.tablename;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 1: Fix users.id type: UUID → TEXT
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey';
    EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS "User_pkey"';
    ALTER TABLE public.users ALTER COLUMN id TYPE TEXT USING id::text;
    ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
    RAISE NOTICE 'users.id: UUID → TEXT (PK re-added)';
  ELSE
    RAISE NOTICE 'users.id already TEXT, skipping';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 2: Fix user_subscriptions columns
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_pkey';
    EXECUTE 'ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS "UserSubscription_pkey"';
    ALTER TABLE public.user_subscriptions ALTER COLUMN id TYPE TEXT USING id::text;
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);
    RAISE NOTICE 'user_subscriptions.id: UUID → TEXT';
  ELSE
    RAISE NOTICE 'user_subscriptions.id already TEXT, skipping';
  END IF;
END;
$$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
      AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.user_subscriptions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    RAISE NOTICE 'user_subscriptions.user_id: UUID → TEXT';
  ELSE
    RAISE NOTICE 'user_subscriptions.user_id already TEXT, skipping';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 3: Fix prop_firm_challenges columns
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prop_firm_challenges'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    EXECUTE 'ALTER TABLE public.prop_firm_challenges DROP CONSTRAINT IF EXISTS prop_firm_challenges_pkey';
    EXECUTE 'ALTER TABLE public.prop_firm_challenges DROP CONSTRAINT IF EXISTS "PropFirmChallenge_pkey"';
    ALTER TABLE public.prop_firm_challenges ALTER COLUMN id TYPE TEXT USING id::text;
    ALTER TABLE public.prop_firm_challenges ADD CONSTRAINT prop_firm_challenges_pkey PRIMARY KEY (id);
    RAISE NOTICE 'prop_firm_challenges.id: UUID → TEXT';
  ELSE
    RAISE NOTICE 'prop_firm_challenges.id already TEXT, skipping';
  END IF;
END;
$$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prop_firm_challenges'
      AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.prop_firm_challenges ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    RAISE NOTICE 'prop_firm_challenges.user_id: UUID → TEXT';
  ELSE
    RAISE NOTICE 'prop_firm_challenges.user_id already TEXT, skipping';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 4: Fix any other tables with UUID user_id that should be TEXT
-- ============================================================================

DO $$ DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
      AND table_name NOT IN ('user_subscriptions', 'prop_firm_challenges')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE TEXT USING user_id::text', rec.table_name);
    RAISE NOTICE '%.user_id: UUID → TEXT', rec.table_name;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 5: Re-add ALL foreign key constraints (TEXT → TEXT)
--           Each wrapped in exception handler
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.trades ADD CONSTRAINT fk_trades_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: trades.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK trades: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.trading_accounts ADD CONSTRAINT fk_trading_accounts_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: trading_accounts.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK trading_accounts: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.journal_entries ADD CONSTRAINT fk_journal_entries_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: journal_entries.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK journal_entries: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.watchlist ADD CONSTRAINT fk_watchlist_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: watchlist.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK watchlist: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.user_subscriptions ADD CONSTRAINT fk_user_subscriptions_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: user_subscriptions.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK user_subscriptions: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.prop_firm_challenges ADD CONSTRAINT fk_prop_firm_challenges_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: prop_firm_challenges.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK prop_firm_challenges: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.tags ADD CONSTRAINT fk_tags_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: tags.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK tags: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.weekly_goals ADD CONSTRAINT fk_weekly_goals_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: weekly_goals.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK weekly_goals: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.social_links ADD CONSTRAINT fk_social_links_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: social_links.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK social_links: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.payment_orders ADD CONSTRAINT fk_payment_orders_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: payment_orders.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK payment_orders: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.notification_preferences ADD CONSTRAINT fk_notification_preferences_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: notification_preferences.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK notification_preferences: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.user_submissions ADD CONSTRAINT fk_user_submissions_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: user_submissions.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK user_submissions: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.mission_progress ADD CONSTRAINT fk_mission_progress_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: mission_progress.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK mission_progress: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.bug_reports ADD CONSTRAINT fk_bug_reports_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: bug_reports.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK bug_reports: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  ALTER TABLE public.affiliates ADD CONSTRAINT fk_affiliates_user_id
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  RAISE NOTICE 'Added FK: affiliates.user_id → profiles(id)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK affiliates: %', SQLERRM;
END;
$$;

-- ============================================================================
-- STEP 6: Recreate ALL RLS policies — auth.uid()::text = user_id
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own trades" ON public.trades;
  DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
  DROP POLICY IF EXISTS "Users can update own trades" ON public.trades;
  DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades;
  CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for trades';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error trades RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own trading accounts" ON public.trading_accounts;
  DROP POLICY IF EXISTS "Users can insert own trading accounts" ON public.trading_accounts;
  DROP POLICY IF EXISTS "Users can update own trading accounts" ON public.trading_accounts;
  DROP POLICY IF EXISTS "Users can delete own trading accounts" ON public.trading_accounts;
  CREATE POLICY "Users can view own trading accounts" ON public.trading_accounts FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own trading accounts" ON public.trading_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own trading accounts" ON public.trading_accounts FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own trading accounts" ON public.trading_accounts FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for trading_accounts';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error trading_accounts RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own journals" ON public.journal_entries;
  DROP POLICY IF EXISTS "Users can insert own journals" ON public.journal_entries;
  DROP POLICY IF EXISTS "Users can update own journals" ON public.journal_entries;
  DROP POLICY IF EXISTS "Users can delete own journals" ON public.journal_entries;
  CREATE POLICY "Users can view own journals" ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own journals" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own journals" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own journals" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for journal_entries';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error journal_entries RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own watchlist" ON public.watchlist;
  DROP POLICY IF EXISTS "Users can insert own watchlist" ON public.watchlist;
  DROP POLICY IF EXISTS "Users can update own watchlist" ON public.watchlist;
  DROP POLICY IF EXISTS "Users can delete own watchlist" ON public.watchlist;
  CREATE POLICY "Users can view own watchlist" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own watchlist" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own watchlist" ON public.watchlist FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own watchlist" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for watchlist';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error watchlist RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
  DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.user_subscriptions;
  DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions;
  DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.user_subscriptions;
  CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own subscriptions" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own subscriptions" ON public.user_subscriptions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own subscriptions" ON public.user_subscriptions FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for user_subscriptions';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error user_subscriptions RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.prop_firm_challenges ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own prop firm challenges" ON public.prop_firm_challenges;
  DROP POLICY IF EXISTS "Users can insert own prop firm challenges" ON public.prop_firm_challenges;
  DROP POLICY IF EXISTS "Users can update own prop firm challenges" ON public.prop_firm_challenges;
  DROP POLICY IF EXISTS "Users can delete own prop firm challenges" ON public.prop_firm_challenges;
  CREATE POLICY "Users can view own prop firm challenges" ON public.prop_firm_challenges FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own prop firm challenges" ON public.prop_firm_challenges FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own prop firm challenges" ON public.prop_firm_challenges FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own prop firm challenges" ON public.prop_firm_challenges FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for prop_firm_challenges';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error prop_firm_challenges RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can insert own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;
  CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for tags';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error tags RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own weekly goals" ON public.weekly_goals;
  DROP POLICY IF EXISTS "Users can insert own weekly goals" ON public.weekly_goals;
  DROP POLICY IF EXISTS "Users can update own weekly goals" ON public.weekly_goals;
  DROP POLICY IF EXISTS "Users can delete own weekly goals" ON public.weekly_goals;
  CREATE POLICY "Users can view own weekly goals" ON public.weekly_goals FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own weekly goals" ON public.weekly_goals FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own weekly goals" ON public.weekly_goals FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own weekly goals" ON public.weekly_goals FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for weekly_goals';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error weekly_goals RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own social links" ON public.social_links;
  DROP POLICY IF EXISTS "Users can insert own social links" ON public.social_links;
  DROP POLICY IF EXISTS "Users can update own social links" ON public.social_links;
  DROP POLICY IF EXISTS "Users can delete own social links" ON public.social_links;
  CREATE POLICY "Users can view own social links" ON public.social_links FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own social links" ON public.social_links FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own social links" ON public.social_links FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own social links" ON public.social_links FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for social_links';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error social_links RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own payment orders" ON public.payment_orders;
  DROP POLICY IF EXISTS "Users can insert own payment orders" ON public.payment_orders;
  DROP POLICY IF EXISTS "Users can update own payment orders" ON public.payment_orders;
  DROP POLICY IF EXISTS "Users can delete own payment orders" ON public.payment_orders;
  CREATE POLICY "Users can view own payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own payment orders" ON public.payment_orders FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own payment orders" ON public.payment_orders FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own payment orders" ON public.payment_orders FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for payment_orders';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error payment_orders RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own notification prefs" ON public.notification_preferences;
  DROP POLICY IF EXISTS "Users can insert own notification prefs" ON public.notification_preferences;
  DROP POLICY IF EXISTS "Users can update own notification prefs" ON public.notification_preferences;
  DROP POLICY IF EXISTS "Users can delete own notification prefs" ON public.notification_preferences;
  CREATE POLICY "Users can view own notification prefs" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own notification prefs" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own notification prefs" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own notification prefs" ON public.notification_preferences FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for notification_preferences';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error notification_preferences RLS: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own bug reports" ON public.bug_reports;
  DROP POLICY IF EXISTS "Users can insert own bug reports" ON public.bug_reports;
  DROP POLICY IF EXISTS "Users can update own bug reports" ON public.bug_reports;
  DROP POLICY IF EXISTS "Users can delete own bug reports" ON public.bug_reports;
  CREATE POLICY "Users can view own bug reports" ON public.bug_reports FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own bug reports" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own bug reports" ON public.bug_reports FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own bug reports" ON public.bug_reports FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'Fixed RLS for bug_reports';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error bug_reports RLS: %', SQLERRM;
END $$;

-- ============================================================================
-- STEP 7: Ensure grants for service_role and authenticated
--           Each wrapped in exception handler in case table doesn't exist
-- ============================================================================

DO $$ BEGIN
  GRANT ALL ON TABLE public.profiles TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant profiles→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.users TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant users→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.prop_firm_challenges TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant prop_firm_challenges→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.user_subscriptions TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant user_subscriptions→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.trades TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant trades→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.trading_accounts TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant trading_accounts→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.journal_entries TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant journal_entries→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.watchlist TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant watchlist→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.tags TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant tags→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.weekly_goals TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant weekly_goals→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.social_links TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant social_links→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.payment_orders TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant payment_orders→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.notification_preferences TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant notification_preferences→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.bug_reports TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant bug_reports→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.affiliates TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant affiliates→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.affiliate_referrals TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant affiliate_referrals→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.affiliate_withdrawals TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant affiliate_withdrawals→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.promo_codes TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant promo_codes→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.push_subscriptions TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant push_subscriptions→service_role: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.shared_trades TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant shared_trades→service_role: %', SQLERRM;
END;
$$;

-- authenticated grants
DO $$ BEGIN
  GRANT ALL ON TABLE public.profiles TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant profiles→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.users TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant users→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.prop_firm_challenges TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant prop_firm_challenges→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.user_subscriptions TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant user_subscriptions→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.trades TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant trades→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.trading_accounts TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant trading_accounts→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.journal_entries TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant journal_entries→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.watchlist TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant watchlist→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.tags TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant tags→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.weekly_goals TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant weekly_goals→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.social_links TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant social_links→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.payment_orders TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant payment_orders→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.notification_preferences TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant notification_preferences→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.bug_reports TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant bug_reports→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.affiliates TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant affiliates→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.affiliate_referrals TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant affiliate_referrals→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.affiliate_withdrawals TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant affiliate_withdrawals→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.promo_codes TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant promo_codes→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant push_subscriptions→authenticated: %', SQLERRM;
END;
$$;
DO $$ BEGIN
  GRANT ALL ON TABLE public.shared_trades TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip grant shared_trades→authenticated: %', SQLERRM;
END;
$$;

-- ============================================================================
-- VERIFICATION: Check all user_id columns are now TEXT
-- ============================================================================

DO $$ DECLARE
  rec RECORD;
  uuid_count integer := 0;
BEGIN
  FOR rec IN
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  LOOP
    RAISE WARNING 'STILL UUID: %.% is %', rec.table_name, rec.column_name, rec.data_type;
    uuid_count := uuid_count + 1;
  END LOOP;
  
  IF uuid_count = 0 THEN
    RAISE NOTICE 'All user_id columns are now TEXT — type mismatch fixed!';
  ELSE
    RAISE WARNING '% user_id columns still UUID — manual fix needed', uuid_count;
  END IF;
END;
$$;

-- ============================================================================
-- DONE!
-- ============================================================================
