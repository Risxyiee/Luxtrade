-- ============================================================================
-- COMPREHENSIVE FIX: All Type Mismatches, FK Constraints, and RLS Policies
-- Date: 2026-10-01 (Final)
-- 
-- Run this ONCE in Supabase SQL Editor.
-- It is IDEMPOTENT — safe to re-run if it partially fails.
--
-- Fixes:
-- 1. users.id UUID → TEXT (to match profiles.id)
-- 2. user_subscriptions.user_id UUID → TEXT
-- 3. user_subscriptions.id UUID → TEXT  
-- 4. prop_firm_challenges.user_id UUID → TEXT
-- 5. prop_firm_challenges.id UUID → TEXT
-- 6. All FKs re-pointed to profiles(id) which is TEXT
-- 7. ALL RLS policies fixed: auth.uid()::text = user_id
-- 8. Service role grants for admin API access
-- ============================================================================

-- ============================================================================
-- STEP 0: Drop ALL foreign key constraints that reference users(id) or 
--         profiles(id) — we'll recreate them after type changes
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
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND (
        -- FK references users(id)
        (ccu.table_name = 'users' AND ccu.column_name = 'id')
        OR
        -- FK references profiles(id)
        (ccu.table_name = 'profiles' AND ccu.column_name = 'id')
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    RAISE NOTICE 'Dropped FK: % on %.%', rec.constraint_name, rec.table_name, rec.column_name;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 1: Fix users.id type: UUID → TEXT
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    -- Drop PK constraint first
    EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey';
    EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS "User_pkey"';
    
    -- Change type
    ALTER TABLE public.users ALTER COLUMN id TYPE TEXT USING id::text;
    
    -- Re-add PK
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

-- 2a. user_subscriptions.id UUID → TEXT
DO $$
BEGIN
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

-- 2b. user_subscriptions.user_id UUID → TEXT
DO $$
BEGIN
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

-- 3a. prop_firm_challenges.id UUID → TEXT
DO $$
BEGIN
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

-- 3b. prop_firm_challenges.user_id UUID → TEXT
DO $$
BEGIN
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
-- Check ALL tables for user_id columns that are UUID
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
      AND table_name NOT IN ('user_subscriptions', 'prop_firm_challenges') -- already handled
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE TEXT USING user_id::text', rec.table_name);
    RAISE NOTICE '%.user_id: UUID → TEXT', rec.table_name;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 5: Re-add ALL foreign key constraints (TEXT → TEXT)
-- All user_id FKs now point to profiles(id) which is TEXT
-- ============================================================================

-- Helper function to safely add FK
DO $$
BEGIN
  -- trades.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'trades' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.trades ADD CONSTRAINT fk_trades_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: trades.user_id → profiles(id)';
  END IF;

  -- trading_accounts.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'trading_accounts' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.trading_accounts ADD CONSTRAINT fk_trading_accounts_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: trading_accounts.user_id → profiles(id)';
  END IF;

  -- journal_entries.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'journal_entries' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.journal_entries ADD CONSTRAINT fk_journal_entries_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: journal_entries.user_id → profiles(id)';
  END IF;

  -- watchlist.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'watchlist' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.watchlist ADD CONSTRAINT fk_watchlist_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: watchlist.user_id → profiles(id)';
  END IF;

  -- user_subscriptions.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'user_subscriptions' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT fk_user_subscriptions_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: user_subscriptions.user_id → profiles(id)';
  END IF;

  -- prop_firm_challenges.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'prop_firm_challenges' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.prop_firm_challenges ADD CONSTRAINT fk_prop_firm_challenges_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: prop_firm_challenges.user_id → profiles(id)';
  END IF;

  -- tags.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'tags' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.tags ADD CONSTRAINT fk_tags_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: tags.user_id → profiles(id)';
  END IF;

  -- weekly_goals.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'weekly_goals' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.weekly_goals ADD CONSTRAINT fk_weekly_goals_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: weekly_goals.user_id → profiles(id)';
  END IF;

  -- social_links.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'social_links' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.social_links ADD CONSTRAINT fk_social_links_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: social_links.user_id → profiles(id)';
  END IF;

  -- payment_orders.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'payment_orders' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.payment_orders ADD CONSTRAINT fk_payment_orders_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: payment_orders.user_id → profiles(id)';
  END IF;

  -- notification_preferences.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'notification_preferences' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.notification_preferences ADD CONSTRAINT fk_notification_preferences_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: notification_preferences.user_id → profiles(id)';
  END IF;

  -- user_submissions.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'user_submissions' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.user_submissions ADD CONSTRAINT fk_user_submissions_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: user_submissions.user_id → profiles(id)';
  END IF;

  -- mission_progress.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'mission_progress' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.mission_progress ADD CONSTRAINT fk_mission_progress_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: mission_progress.user_id → profiles(id)';
  END IF;

  -- bug_reports.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'bug_reports' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.bug_reports ADD CONSTRAINT fk_bug_reports_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: bug_reports.user_id → profiles(id)';
  END IF;

  -- affiliates.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'affiliates' AND tc.table_schema = 'public'
      AND ccu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.affiliates ADD CONSTRAINT fk_affiliates_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: affiliates.user_id → profiles(id)';
  END IF;

END;
$$;

-- ============================================================================
-- STEP 6: Fix ALL RLS policies — auth.uid()::text = user_id
-- For ALL tables with user_id column
-- ============================================================================

-- 6a. trades
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

-- 6b. trading_accounts
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

-- 6c. journal_entries
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

-- 6d. watchlist
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

-- 6e. user_subscriptions
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

-- 6f. prop_firm_challenges
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

-- 6g. tags
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

-- 6h. weekly_goals
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

-- 6i. social_links
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

-- 6j. payment_orders
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

-- 6k. notification_preferences
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

-- 6l. bug_reports
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
-- STEP 7: Ensure service_role has ALL on tables used by admin API
-- ============================================================================

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.prop_firm_challenges TO service_role;
GRANT ALL ON TABLE public.user_subscriptions TO service_role;
GRANT ALL ON TABLE public.trades TO service_role;
GRANT ALL ON TABLE public.trading_accounts TO service_role;
GRANT ALL ON TABLE public.journal_entries TO service_role;
GRANT ALL ON TABLE public.watchlist TO service_role;
GRANT ALL ON TABLE public.tags TO service_role;
GRANT ALL ON TABLE public.weekly_goals TO service_role;
GRANT ALL ON TABLE public.social_links TO service_role;
GRANT ALL ON TABLE public.payment_orders TO service_role;
GRANT ALL ON TABLE public.notification_preferences TO service_role;
GRANT ALL ON TABLE public.bug_reports TO service_role;
GRANT ALL ON TABLE public.affiliates TO service_role;
GRANT ALL ON TABLE public.affiliate_referrals TO service_role;
GRANT ALL ON TABLE public.affiliate_withdrawals TO service_role;
GRANT ALL ON TABLE public.promo_codes TO service_role;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
GRANT ALL ON TABLE public.shared_trades TO service_role;

-- Ensure authenticated role can read/write too (RLS handles the filtering)
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.prop_firm_challenges TO authenticated;
GRANT ALL ON TABLE public.user_subscriptions TO authenticated;
GRANT ALL ON TABLE public.trades TO authenticated;
GRANT ALL ON TABLE public.trading_accounts TO authenticated;
GRANT ALL ON TABLE public.journal_entries TO authenticated;
GRANT ALL ON TABLE public.watchlist TO authenticated;
GRANT ALL ON TABLE public.tags TO authenticated;
GRANT ALL ON TABLE public.weekly_goals TO authenticated;
GRANT ALL ON TABLE public.social_links TO authenticated;
GRANT ALL ON TABLE public.payment_orders TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.bug_reports TO authenticated;
GRANT ALL ON TABLE public.affiliates TO authenticated;
GRANT ALL ON TABLE public.affiliate_referrals TO authenticated;
GRANT ALL ON TABLE public.affiliate_withdrawals TO authenticated;
GRANT ALL ON TABLE public.promo_codes TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.shared_trades TO authenticated;

-- ============================================================================
-- VERIFICATION: Check all user_id columns are now TEXT
-- ============================================================================

DO $$
DECLARE
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
    RAISE NOTICE '✅ All user_id columns are now TEXT — type mismatch fixed!';
  ELSE
    RAISE WARNING '⚠️ % user_id columns still UUID — manual fix needed', uuid_count;
  END IF;
END;
$$;

-- ============================================================================
-- DONE!
-- ============================================================================
-- After running this SQL:
-- 1. Clear CF KV cache (wrangler kv key delete --namespace-id=<id> "news_cache")
-- 2. Push code changes: git push (will trigger CF Pages rebuild)
-- 3. Test: edit prop firm challenge → all fields should save
-- 4. Test: add a trade → should save successfully  
-- 5. Test: watchlist prices → should show real-time values
-- 6. Test: news → should show real articles, not placeholder
-- ============================================================================
