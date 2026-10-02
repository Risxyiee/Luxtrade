-- ============================================================================
-- COMPREHENSIVE FIX V6 — UUID→TEXT for all user_id columns
-- Run ONCE in Supabase SQL Editor. Idempotent & error-safe.
--
-- KEY FIX vs V5: Uses $func$ instead of $$ to avoid Supabase SQL Editor
-- parser bug that causes "@ syntax error" with dollar-quoting
-- ============================================================================

-- ═══ STEP 0a: Drop ALL FKs on user_id / id columns ═══

DO $func$
DECLARE r RECORD;
BEGIN
  -- Drop FKs on user_id columns
  FOR r IN
    SELECT tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND kcu.column_name = 'user_id'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
      RAISE NOTICE 'Dropped FK: % on %.%', r.constraint_name, r.table_name, r.column_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip drop FK: %', SQLERRM;
    END;
  END LOOP;

  -- Drop FKs on id columns of key tables
  FOR r IN
    SELECT tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND kcu.column_name = 'id'
      AND tc.table_name IN ('users', 'user_subscriptions', 'prop_firm_challenges')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
      RAISE NOTICE 'Dropped FK: % on %.%', r.constraint_name, r.table_name, r.column_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip drop FK: %', SQLERRM;
    END;
  END LOOP;

  -- Drop FKs that reference users(id), profiles(id), user_subscriptions(id), prop_firm_challenges(id)
  FOR r IN
    SELECT tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND (
        (ccu.table_name = 'users' AND ccu.column_name = 'id')
        OR (ccu.table_name = 'profiles' AND ccu.column_name = 'id')
        OR (ccu.table_name = 'user_subscriptions' AND ccu.column_name = 'id')
        OR (ccu.table_name = 'prop_firm_challenges' AND ccu.column_name = 'id')
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
      RAISE NOTICE 'Dropped ref FK: % on %.%', r.constraint_name, r.table_name, r.column_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip drop ref FK: %', SQLERRM;
    END;
  END LOOP;
END;
$func$;

-- ═══ STEP 0b: Drop ALL RLS policies on affected tables ═══

DO $func$
DECLARE p RECORD;
BEGIN
  -- Drop policies on users, user_subscriptions, prop_firm_challenges
  FOR p IN
    SELECT DISTINCT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'user_subscriptions', 'prop_firm_challenges')
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
      RAISE NOTICE 'Dropped policy: % on %', p.policyname, p.tablename;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip drop policy: %', SQLERRM;
    END;
  END LOOP;

  -- Drop policies on all tables that have user_id column
  FOR p IN
    SELECT DISTINCT p2.tablename, p2.policyname
    FROM pg_policies p2
    JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = p2.tablename AND c.column_name = 'user_id'
    WHERE p2.schemaname = 'public'
      AND p2.tablename NOT IN ('users', 'user_subscriptions', 'prop_firm_challenges')
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
      RAISE NOTICE 'Dropped policy: % on %', p.policyname, p.tablename;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip drop policy: %', SQLERRM;
    END;
  END LOOP;
END;
$func$;

-- ═══ STEP 1: users.id UUID → TEXT ═══

DO $func$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='id' AND data_type='uuid') THEN
    EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey';
    EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS "User_pkey"';
    ALTER TABLE public.users ALTER COLUMN id TYPE TEXT USING id::text;
    ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
    RAISE NOTICE 'users.id: UUID → TEXT';
  ELSE RAISE NOTICE 'users.id already TEXT'; END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error users.id: %', SQLERRM;
END; $func$;

-- ═══ STEP 2: user_subscriptions.id & user_id UUID → TEXT ═══

DO $func$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_subscriptions' AND column_name='id' AND data_type='uuid') THEN
    EXECUTE 'ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_pkey';
    EXECUTE 'ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS "UserSubscription_pkey"';
    ALTER TABLE public.user_subscriptions ALTER COLUMN id TYPE TEXT USING id::text;
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);
    RAISE NOTICE 'user_subscriptions.id: UUID → TEXT';
  ELSE RAISE NOTICE 'user_subscriptions.id already TEXT'; END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error user_subscriptions.id: %', SQLERRM;
END; $func$;

DO $func$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_subscriptions' AND column_name='user_id' AND data_type='uuid') THEN
    ALTER TABLE public.user_subscriptions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    RAISE NOTICE 'user_subscriptions.user_id: UUID → TEXT';
  ELSE RAISE NOTICE 'user_subscriptions.user_id already TEXT'; END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error user_subscriptions.user_id: %', SQLERRM;
END; $func$;

-- ═══ STEP 3: prop_firm_challenges.id & user_id UUID → TEXT ═══

DO $func$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prop_firm_challenges' AND column_name='id' AND data_type='uuid') THEN
    EXECUTE 'ALTER TABLE public.prop_firm_challenges DROP CONSTRAINT IF EXISTS prop_firm_challenges_pkey';
    EXECUTE 'ALTER TABLE public.prop_firm_challenges DROP CONSTRAINT IF EXISTS "PropFirmChallenge_pkey"';
    ALTER TABLE public.prop_firm_challenges ALTER COLUMN id TYPE TEXT USING id::text;
    ALTER TABLE public.prop_firm_challenges ADD CONSTRAINT prop_firm_challenges_pkey PRIMARY KEY (id);
    RAISE NOTICE 'prop_firm_challenges.id: UUID → TEXT';
  ELSE RAISE NOTICE 'prop_firm_challenges.id already TEXT'; END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error prop_firm_challenges.id: %', SQLERRM;
END; $func$;

DO $func$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prop_firm_challenges' AND column_name='user_id' AND data_type='uuid') THEN
    ALTER TABLE public.prop_firm_challenges ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    RAISE NOTICE 'prop_firm_challenges.user_id: UUID → TEXT';
  ELSE RAISE NOTICE 'prop_firm_challenges.user_id already TEXT'; END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Error prop_firm_challenges.user_id: %', SQLERRM;
END; $func$;

-- ═══ STEP 4: Fix ALL other UUID user_id columns → TEXT ═══

DO $func$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='user_id' AND data_type='uuid'
      AND table_name NOT IN ('user_subscriptions','prop_firm_challenges')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE TEXT USING user_id::text', r.table_name);
      RAISE NOTICE '%.user_id: UUID → TEXT', r.table_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip %.user_id: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END;
$func$;

-- ═══ STEP 5: Re-add FK constraints (TEXT→TEXT) — each in exception handler ═══

DO $func$ BEGIN ALTER TABLE public.trades ADD CONSTRAINT fk_trades_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: trades→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK trades: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.trading_accounts ADD CONSTRAINT fk_trading_accounts_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: trading_accounts→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK trading_accounts: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.journal_entries ADD CONSTRAINT fk_journal_entries_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: journal_entries→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK journal_entries: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.watchlist ADD CONSTRAINT fk_watchlist_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: watchlist→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK watchlist: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.user_subscriptions ADD CONSTRAINT fk_user_subscriptions_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: user_subscriptions→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK user_subscriptions: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.prop_firm_challenges ADD CONSTRAINT fk_prop_firm_challenges_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: prop_firm_challenges→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK prop_firm_challenges: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.tags ADD CONSTRAINT fk_tags_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: tags→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK tags: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.weekly_goals ADD CONSTRAINT fk_weekly_goals_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: weekly_goals→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK weekly_goals: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.social_links ADD CONSTRAINT fk_social_links_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: social_links→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK social_links: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.payment_orders ADD CONSTRAINT fk_payment_orders_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: payment_orders→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK payment_orders: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.notification_preferences ADD CONSTRAINT fk_notification_preferences_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: notification_preferences→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK notification_preferences: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.user_submissions ADD CONSTRAINT fk_user_submissions_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: user_submission→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK user_submission: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.mission_progress ADD CONSTRAINT fk_mission_progress_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: mission_progress→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK mission_progress: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.bug_reports ADD CONSTRAINT fk_bug_reports_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: bug_reports→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK bug_reports: %', SQLERRM; END; $func$;
DO $func$ BEGIN ALTER TABLE public.affiliates ADD CONSTRAINT fk_affiliates_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; RAISE NOTICE 'FK: affiliates→profiles'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip FK affiliates: %', SQLERRM; END; $func$;

-- ═══ STEP 6: Recreate RLS policies with auth.uid()::text = user_id ═══

-- trades
DO $func$ BEGIN
  ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own trades" ON public.trades;
  DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
  DROP POLICY IF EXISTS "Users can update own trades" ON public.trades;
  DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades;
  CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: trades';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip trades: %', SQLERRM;
END; $func$;

-- trading_accounts
DO $func$ BEGIN
  ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own trading accounts" ON public.trading_accounts;
  DROP POLICY IF EXISTS "Users can insert own trading accounts" ON public.trading_accounts;
  DROP POLICY IF EXISTS "Users can update own trading accounts" ON public.trading_accounts;
  DROP POLICY IF EXISTS "Users can delete own trading accounts" ON public.trading_accounts;
  CREATE POLICY "Users can view own trading accounts" ON public.trading_accounts FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own trading accounts" ON public.trading_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own trading accounts" ON public.trading_accounts FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own trading accounts" ON public.trading_accounts FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: trading_accounts';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip trading_accounts: %', SQLERRM;
END; $func$;

-- journal_entries
DO $func$ BEGIN
  ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own journals" ON public.journal_entries;
  DROP POLICY IF EXISTS "Users can insert own journals" ON public.journal_entries;
  DROP POLICY IF EXISTS "Users can update own journals" ON public.journal_entries;
  DROP POLICY IF EXISTS "Users can delete own journals" ON public.journal_entries;
  CREATE POLICY "Users can view own journals" ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own journals" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own journals" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own journals" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: journal_entries';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip journal_entries: %', SQLERRM;
END; $func$;

-- watchlist
DO $func$ BEGIN
  ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own watchlist" ON public.watchlist;
  DROP POLICY IF EXISTS "Users can insert own watchlist" ON public.watchlist;
  DROP POLICY IF EXISTS "Users can update own watchlist" ON public.watchlist;
  DROP POLICY IF EXISTS "Users can delete own watchlist" ON public.watchlist;
  CREATE POLICY "Users can view own watchlist" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own watchlist" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own watchlist" ON public.watchlist FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own watchlist" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: watchlist';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip watchlist: %', SQLERRM;
END; $func$;

-- user_subscriptions
DO $func$ BEGIN
  ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
  DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.user_subscriptions;
  DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions;
  DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.user_subscriptions;
  CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own subscriptions" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own subscriptions" ON public.user_subscriptions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own subscriptions" ON public.user_subscriptions FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: user_subscriptions';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip user_subscriptions: %', SQLERRM;
END; $func$;

-- prop_firm_challenges
DO $func$ BEGIN
  ALTER TABLE public.prop_firm_challenges ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own prop firm challenges" ON public.prop_firm_challenges;
  DROP POLICY IF EXISTS "Users can insert own prop firm challenges" ON public.prop_firm_challenges;
  DROP POLICY IF EXISTS "Users can update own prop firm challenges" ON public.prop_firm_challenges;
  DROP POLICY IF EXISTS "Users can delete own prop firm challenges" ON public.prop_firm_challenges;
  CREATE POLICY "Users can view own prop firm challenges" ON public.prop_firm_challenges FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own prop firm challenges" ON public.prop_firm_challenges FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own prop firm challenges" ON public.prop_firm_challenges FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own prop firm challenges" ON public.prop_firm_challenges FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: prop_firm_challenges';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip prop_firm_challenges: %', SQLERRM;
END; $func$;

-- tags
DO $func$ BEGIN
  ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can insert own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;
  CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: tags';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip tags: %', SQLERRM;
END; $func$;

-- weekly_goals
DO $func$ BEGIN
  ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own weekly goals" ON public.weekly_goals;
  DROP POLICY IF EXISTS "Users can insert own weekly goals" ON public.weekly_goals;
  DROP POLICY IF EXISTS "Users can update own weekly goals" ON public.weekly_goals;
  DROP POLICY IF EXISTS "Users can delete own weekly goals" ON public.weekly_goals;
  CREATE POLICY "Users can view own weekly goals" ON public.weekly_goals FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own weekly goals" ON public.weekly_goals FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own weekly goals" ON public.weekly_goals FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own weekly goals" ON public.weekly_goals FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: weekly_goals';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip weekly_goals: %', SQLERRM;
END; $func$;

-- social_links
DO $func$ BEGIN
  ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own social links" ON public.social_links;
  DROP POLICY IF EXISTS "Users can insert own social links" ON public.social_links;
  DROP POLICY IF EXISTS "Users can update own social links" ON public.social_links;
  DROP POLICY IF EXISTS "Users can delete own social links" ON public.social_links;
  CREATE POLICY "Users can view own social links" ON public.social_links FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own social links" ON public.social_links FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own social links" ON public.social_links FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own social links" ON public.social_links FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: social_links';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip social_links: %', SQLERRM;
END; $func$;

-- payment_orders
DO $func$ BEGIN
  ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own payment orders" ON public.payment_orders;
  DROP POLICY IF EXISTS "Users can insert own payment orders" ON public.payment_orders;
  DROP POLICY IF EXISTS "Users can update own payment orders" ON public.payment_orders;
  DROP POLICY IF EXISTS "Users can delete own payment orders" ON public.payment_orders;
  CREATE POLICY "Users can view own payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own payment orders" ON public.payment_orders FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own payment orders" ON public.payment_orders FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own payment orders" ON public.payment_orders FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: payment_orders';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip payment_orders: %', SQLERRM;
END; $func$;

-- notification_preferences
DO $func$ BEGIN
  ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own notification prefs" ON public.notification_preferences;
  DROP POLICY IF EXISTS "Users can insert own notification prefs" ON public.notification_preferences;
  DROP POLICY IF EXISTS "Users can update own notification prefs" ON public.notification_preferences;
  DROP POLICY IF EXISTS "Users can delete own notification prefs" ON public.notification_preferences;
  CREATE POLICY "Users can view own notification prefs" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own notification prefs" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own notification prefs" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own notification prefs" ON public.notification_preferences FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: notification_preferences';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip notification_preferences: %', SQLERRM;
END; $func$;

-- bug_reports
DO $func$ BEGIN
  ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own bug reports" ON public.bug_reports;
  DROP POLICY IF EXISTS "Users can insert own bug reports" ON public.bug_reports;
  DROP POLICY IF EXISTS "Users can update own bug reports" ON public.bug_reports;
  DROP POLICY IF EXISTS "Users can delete own bug reports" ON public.bug_reports;
  CREATE POLICY "Users can view own bug reports" ON public.bug_reports FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own bug reports" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own bug reports" ON public.bug_reports FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own bug reports" ON public.bug_reports FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
  RAISE NOTICE 'RLS OK: bug_reports';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS skip bug_reports: %', SQLERRM;
END; $func$;

-- ═══ STEP 7: GRANTs — each in exception handler ═══

-- service_role
DO $func$ BEGIN GRANT ALL ON TABLE public.profiles TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.users TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.prop_firm_challenges TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.user_subscriptions TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.trades TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.trading_accounts TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.journal_entries TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.watchlist TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.tags TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.weekly_goals TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.social_links TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.payment_orders TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.notification_preferences TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.bug_reports TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.affiliates TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.affiliate_referrals TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.affiliate_withdrawals TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.promo_codes TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.push_subscriptions TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.shared_trades TO service_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;

-- authenticated
DO $func$ BEGIN GRANT ALL ON TABLE public.profiles TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.users TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.prop_firm_challenges TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.user_subscriptions TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.trades TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.trading_accounts TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.journal_entries TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.watchlist TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.tags TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.weekly_goals TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.social_links TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.payment_orders TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.notification_preferences TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.bug_reports TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.affiliates TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.affiliate_referrals TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.affiliate_withdrawals TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.promo_codes TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.push_subscriptions TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;
DO $func$ BEGIN GRANT ALL ON TABLE public.shared_trades TO authenticated; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip: %', SQLERRM; END; $func$;

-- ═══ VERIFICATION ═══

DO $func$
DECLARE r RECORD; c integer := 0;
BEGIN
  FOR r IN SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND column_name='user_id' AND data_type='uuid'
  LOOP
    RAISE WARNING 'STILL UUID: %.% = %', r.table_name, r.column_name, r.data_type;
    c := c + 1;
  END LOOP;
  IF c = 0 THEN RAISE NOTICE 'SUCCESS: All user_id columns are TEXT!'; 
  ELSE RAISE WARNING '% user_id columns still UUID', c; END IF;
END;
$func$;
