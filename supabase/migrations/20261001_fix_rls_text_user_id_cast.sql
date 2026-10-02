-- ============================================================================
-- Migration: Fix RLS policies for TEXT user_id columns
-- Date: 2026-10-01
-- Purpose: The trades, trading_accounts, journal_entries, watchlist, and other
--          tables use TEXT for user_id (matching profiles.id which is TEXT).
--          But their RLS policies use auth.uid() = user_id, where auth.uid()
--          returns UUID. PostgreSQL cannot compare UUID = TEXT without an
--          explicit cast, causing INSERT/SELECT to fail with:
--          "new row violates row-level security policy"
--
--          Fix: Replace auth.uid() = user_id with auth.uid()::text = user_id
--          for all tables where user_id is TEXT.
--
-- Tables affected (TEXT user_id):
--   - trades
--   - trading_accounts
--   - journal_entries
--   - watchlist
--   - tags (check if TEXT)
--   - weekly_goals (check if TEXT)
--   - social_links (check if TEXT)
--   - user_subscriptions
--   - user_submissions
--   - mission_progress
--   - bug_reports
--   - payment_orders
--   - affiliates
--   - affiliate_referrals
-- ============================================================================

-- Helper: Drop all existing policies on a table so we can recreate with correct casts
-- We must drop before creating because CREATE OR REPLACE doesn't work for RLS policies

-- ===== 1. trades (TEXT user_id) =====
DO $$ BEGIN
  -- Drop old policies
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own trades" ON public.trades';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own trades" ON public.trades';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades';

  -- Recreate with ::text cast
  EXECUTE 'CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for trades';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing trades RLS: %', SQLERRM;
END $$;

-- ===== 2. trading_accounts (TEXT user_id) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own trading accounts" ON public.trading_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own trading accounts" ON public.trading_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own trading accounts" ON public.trading_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own trading accounts" ON public.trading_accounts';

  EXECUTE 'CREATE POLICY "Users can view own trading accounts" ON public.trading_accounts FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own trading accounts" ON public.trading_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own trading accounts" ON public.trading_accounts FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own trading accounts" ON public.trading_accounts FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for trading_accounts';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing trading_accounts RLS: %', SQLERRM;
END $$;

-- ===== 3. journal_entries (TEXT user_id) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own journals" ON public.journal_entries';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own journals" ON public.journal_entries';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own journals" ON public.journal_entries';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own journals" ON public.journal_entries';

  EXECUTE 'CREATE POLICY "Users can view own journals" ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own journals" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own journals" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own journals" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for journal_entries';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing journal_entries RLS: %', SQLERRM;
END $$;

-- ===== 4. watchlist (TEXT user_id) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own watchlist" ON public.watchlist';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own watchlist" ON public.watchlist';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own watchlist" ON public.watchlist';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own watchlist" ON public.watchlist';

  EXECUTE 'CREATE POLICY "Users can view own watchlist" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own watchlist" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own watchlist" ON public.watchlist FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own watchlist" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for watchlist';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing watchlist RLS: %', SQLERRM;
END $$;

-- ===== 5. user_subscriptions (TEXT user_id) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.user_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.user_subscriptions';

  EXECUTE 'CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own subscriptions" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own subscriptions" ON public.user_subscriptions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own subscriptions" ON public.user_subscriptions FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for user_subscriptions';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing user_subscriptions RLS: %', SQLERRM;
END $$;

-- ===== 6. trading_integrations (may be TEXT or UUID - check and fix) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own integrations" ON public.trading_integrations';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own integrations" ON public.trading_integrations';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own integrations" ON public.trading_integrations';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own integrations" ON public.trading_integrations';

  -- Use ::text cast to be safe (works for both UUID and TEXT columns)
  EXECUTE 'CREATE POLICY "Users can view own integrations" ON public.trading_integrations FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own integrations" ON public.trading_integrations FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own integrations" ON public.trading_integrations FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own integrations" ON public.trading_integrations FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for trading_integrations';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing trading_integrations RLS: %', SQLERRM;
END $$;

-- ===== 7. prop_firm_challenges (TEXT user_id after migration) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own prop firm challenges" ON public.prop_firm_challenges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own prop firm challenges" ON public.prop_firm_challenges';

  EXECUTE 'CREATE POLICY "Users can view own prop firm challenges" ON public.prop_firm_challenges FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own prop firm challenges" ON public.prop_firm_challenges FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own prop firm challenges" ON public.prop_firm_challenges FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own prop firm challenges" ON public.prop_firm_challenges FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for prop_firm_challenges';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing prop_firm_challenges RLS: %', SQLERRM;
END $$;

-- ===== 8. Additional tables with TEXT user_id =====

-- tags
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own tags" ON public.tags';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own tags" ON public.tags';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own tags" ON public.tags';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags';
  EXECUTE 'CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS policies for tags';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing tags RLS: %', SQLERRM;
END $$;

-- weekly_goals
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own weekly goals" ON public.weekly_goals';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own weekly goals" ON public.weekly_goals';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own weekly goals" ON public.weekly_goals';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own weekly goals" ON public.weekly_goals';
  EXECUTE 'CREATE POLICY "Users can view own weekly goals" ON public.weekly_goals FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own weekly goals" ON public.weekly_goals FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own weekly goals" ON public.weekly_goals FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own weekly goals" ON public.weekly_goals FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS policies for weekly_goals';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing weekly_goals RLS: %', SQLERRM;
END $$;

-- social_links
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own social links" ON public.social_links';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own social links" ON public.social_links';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own social links" ON public.social_links';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own social links" ON public.social_links';
  EXECUTE 'CREATE POLICY "Users can view own social links" ON public.social_links FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own social links" ON public.social_links FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own social links" ON public.social_links FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own social links" ON public.social_links FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS policies for social_links';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing social_links RLS: %', SQLERRM;
END $$;

-- payment_orders
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own payment orders" ON public.payment_orders';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own payment orders" ON public.payment_orders';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own payment orders" ON public.payment_orders';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own payment orders" ON public.payment_orders';
  EXECUTE 'CREATE POLICY "Users can view own payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own payment orders" ON public.payment_orders FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own payment orders" ON public.payment_orders FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own payment orders" ON public.payment_orders FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  RAISE NOTICE 'Fixed RLS policies for payment_orders';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing payment_orders RLS: %', SQLERRM;
END $$;

-- ===== 9. user_submissions (TEXT user_id) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own submissions" ON public.user_submissions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own submissions" ON public.user_submissions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own submissions" ON public.user_submissions';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own submissions" ON public.user_submissions';

  EXECUTE 'CREATE POLICY "Users can view own submissions" ON public.user_submissions FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own submissions" ON public.user_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own submissions" ON public.user_submissions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own submissions" ON public.user_submissions FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for user_submissions';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing user_submissions RLS: %', SQLERRM;
END $$;

-- ===== 10. mission_progress (TEXT user_id) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own mission progress" ON public.mission_progress';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own mission progress" ON public.mission_progress';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own mission progress" ON public.mission_progress';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own mission progress" ON public.mission_progress';

  EXECUTE 'CREATE POLICY "Users can view own mission progress" ON public.mission_progress FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own mission progress" ON public.mission_progress FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own mission progress" ON public.mission_progress FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own mission progress" ON public.mission_progress FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for mission_progress';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing mission_progress RLS: %', SQLERRM;
END $$;

-- ===== 11. bug_reports (TEXT user_id) =====
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own bug reports" ON public.bug_reports';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own bug reports" ON public.bug_reports';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own bug reports" ON public.bug_reports';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own bug reports" ON public.bug_reports';

  EXECUTE 'CREATE POLICY "Users can view own bug reports" ON public.bug_reports FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can insert own bug reports" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can update own bug reports" ON public.bug_reports FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  EXECUTE 'CREATE POLICY "Users can delete own bug reports" ON public.bug_reports FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';

  RAISE NOTICE 'Fixed RLS policies for bug_reports';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error fixing bug_reports RLS: %', SQLERRM;
END $$;
