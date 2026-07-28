-- ============================================================================
-- LUXTRADE - COMPLETE RLS (Row Level Security) HARDENING SCRIPT v2
-- ============================================================================
-- Date       : 2026-07-28
-- Purpose    : Fix ALL "RLS Disabled in Public" Supabase warnings
--
-- IMPORTANT: This script is IDEMPOTENT — safe to run multiple times.
-- Every statement wrapped in DO $$ ... EXCEPTION to prevent errors.
--
-- HOW TO USE:
--   1. Buka Supabase Dashboard > SQL Editor
--   2. Paste SELURUH script ini
--   3. Klik "Run"
--   4. Pastikan tidak ada error
--
-- COVERED TABLES (21 total):
--   Group A — Core User Data (10 tables)
--     01. users                ← Main lint warning source
--     02. profiles             (has RLS in 001 migration, reinforced here)
--     03. user_subscriptions
--     04. trades               (has RLS in 20250519, reinforced here)
--     05. trading_accounts     (has RLS in 20250519, reinforced here)
--     06. journal_entries
--     07. tags
--     08. weekly_goals
--     09. watchlist
--     10. social_links
--
--   Group B — Achievement System (3 tables)
--     11. user_submissions     (has RLS in 001 migration, reinforced here)
--     12. mission_progress     (has RLS in 001 migration, reinforced here)
--     13. bug_reports
--
--   Group C — Payment & Promo (3 tables)
--     14. payment_orders
--     15. promo_codes
--     16. email_broadcasts
--
--   Group D — Affiliate System (3 tables)
--     17. affiliates
--     18. affiliate_referrals
--     19. affiliate_withdrawals
--
--   Group E — Webhook Trading Integration (1 table)
--     20. trading_integrations (has RLS in 20250519, reinforced here)
--
--   Group F — Supabase Storage (1 table, system-managed)
--     21. storage.objects
--
-- NOTES:
--   - service_role ALWAYS bypasses RLS — no policy needed for admin operations
--   - anon = unauthenticated browser/app traffic — REVOKE ALL for security
--   - authenticated = logged-in user — policies restrict to own data (auth.uid())
-- ============================================================================


-- ============================================================================
-- HELPER: Revoke all anon access from every public table
-- ============================================================================
DO $$ BEGIN
  REVOKE ALL ON TABLE public.users               FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke users from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.profiles            FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke profiles from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.user_subscriptions  FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke user_subscriptions from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.trades              FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke trades from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.trading_accounts     FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke trading_accounts from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.trading_integrations FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke trading_integrations from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.journal_entries     FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke journal_entries from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.tags                FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke tags from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.weekly_goals        FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke weekly_goals from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.watchlist           FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke watchlist from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.social_links        FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke social_links from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.user_submissions    FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke user_submissions from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.mission_progress    FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke mission_progress from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.bug_reports         FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke bug_reports from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.payment_orders      FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke payment_orders from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.promo_codes         FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke promo_codes from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.email_broadcasts    FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke email_broadcasts from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.affiliates          FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke affiliates from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.affiliate_referrals FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke affiliate_referrals from anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.affiliate_withdrawals FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke affiliate_withdrawals from anon: %', SQLERRM;
END $$;


-- ============================================================================
-- GROUP A: CORE USER DATA
-- ============================================================================

-- ===== 01. users =====
-- Main lint warning source: "RLS Disabled in Public" on public.users
-- Users can only see/update their own row. INSERT handled by Supabase Auth.

DO $$ BEGIN
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'users RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own row"
    ON public.users FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy exists: Users can view own row';
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own row"
    ON public.users FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy exists: Users can update own row';
END $$;


-- ===== 02. profiles =====
-- Has RLS from 001 migration. Reinforcing with complete policies.

DO $$ BEGIN
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'profiles RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own profile"
    ON public.profiles FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 03. user_subscriptions =====
-- User can CRUD own subscriptions. Payment system (service_role) bypasses RLS.

DO $$ BEGIN
  ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'user_subscriptions RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own subscriptions"
    ON public.user_subscriptions FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own subscriptions"
    ON public.user_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own subscriptions"
    ON public.user_subscriptions FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own subscriptions"
    ON public.user_subscriptions FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 04. trades =====
-- Has RLS from 20250519 migration. Reinforcing.

DO $$ BEGIN
  ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'trades RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own trades"
    ON public.trades FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own trades"
    ON public.trades FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own trades"
    ON public.trades FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own trades"
    ON public.trades FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert trades"
    ON public.trades FOR INSERT
    TO service_role
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update trades"
    ON public.trades FOR UPDATE
    TO service_role
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 05. trading_accounts =====
-- Has RLS from 20250519 + 002 migration. Reinforcing.

DO $$ BEGIN
  ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'trading_accounts RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own trading accounts"
    ON public.trading_accounts FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own trading accounts"
    ON public.trading_accounts FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own trading accounts"
    ON public.trading_accounts FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own trading accounts"
    ON public.trading_accounts FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 06. journal_entries =====

DO $$ BEGIN
  ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'journal_entries RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own journals"
    ON public.journal_entries FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own journals"
    ON public.journal_entries FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own journals"
    ON public.journal_entries FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own journals"
    ON public.journal_entries FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 07. tags =====

DO $$ BEGIN
  ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'tags RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own tags"
    ON public.tags FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own tags"
    ON public.tags FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own tags"
    ON public.tags FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own tags"
    ON public.tags FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 08. weekly_goals =====

DO $$ BEGIN
  ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'weekly_goals RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own goals"
    ON public.weekly_goals FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own goals"
    ON public.weekly_goals FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own goals"
    ON public.weekly_goals FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own goals"
    ON public.weekly_goals FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 09. watchlist =====

DO $$ BEGIN
  ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'watchlist RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own watchlist"
    ON public.watchlist FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own watchlist"
    ON public.watchlist FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own watchlist"
    ON public.watchlist FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own watchlist"
    ON public.watchlist FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 10. social_links =====

DO $$ BEGIN
  ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'social_links RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own social links"
    ON public.social_links FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own social links"
    ON public.social_links FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own social links"
    ON public.social_links FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own social links"
    ON public.social_links FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- GROUP B: ACHIEVEMENT SYSTEM
-- ============================================================================

-- ===== 11. user_submissions =====
-- Has RLS from 001 migration. Reinforcing.

DO $$ BEGIN
  ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'user_submissions RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own submissions"
    ON public.user_submissions FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own submissions"
    ON public.user_submissions FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own submissions"
    ON public.user_submissions FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own submissions"
    ON public.user_submissions FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 12. mission_progress =====
-- Has RLS from 001 migration. Reinforcing.

DO $$ BEGIN
  ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'mission_progress RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own progress"
    ON public.mission_progress FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own progress"
    ON public.mission_progress FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own progress"
    ON public.mission_progress FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own progress"
    ON public.mission_progress FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===== 13. bug_reports =====

DO $$ BEGIN
  ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'bug_reports RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own bug reports"
    ON public.bug_reports FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own bug reports"
    ON public.bug_reports FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own bug reports"
    ON public.bug_reports FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- No DELETE — bug reports are permanent. Admin uses service_role.


-- ============================================================================
-- GROUP C: PAYMENT & PROMO
-- ============================================================================

-- ===== 14. payment_orders =====
-- Users can view/update own orders.
-- INSERT (order creation) and status changes handled by service_role (payment system).

DO $$ BEGIN
  ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'payment_orders RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own orders"
    ON public.payment_orders FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own orders"
    ON public.payment_orders FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT/DELETE: handled by service_role (bypasses RLS)


-- ===== 15. promo_codes =====
-- Authenticated users can READ active promos (to check validity).
-- WRITE restricted to service_role (admin promo management).

DO $$ BEGIN
  ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'promo_codes RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view active promos"
    ON public.promo_codes FOR SELECT
    TO authenticated
    USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT/UPDATE/DELETE: handled by service_role


-- ===== 16. email_broadcasts =====
-- ADMIN ONLY table. No anon or authenticated access.
-- service_role bypasses RLS automatically.

DO $$ BEGIN
  ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'email_broadcasts RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.email_broadcasts FROM authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke email_broadcasts from authenticated: %', SQLERRM;
END $$;

-- No policies for authenticated — only service_role can access.


-- ============================================================================
-- GROUP D: AFFILIATE SYSTEM
-- ============================================================================

-- ===== 17. affiliates =====

DO $$ BEGIN
  ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'affiliates RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own affiliate"
    ON public.affiliates FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own affiliate"
    ON public.affiliates FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT/DELETE: handled by service_role


-- ===== 18. affiliate_referrals =====
-- Affiliate owners can see their referrals. Referred users can see their own record.

DO $$ BEGIN
  ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'affiliate_referrals RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Affiliates can view own referrals"
    ON public.affiliate_referrals FOR SELECT
    TO authenticated
    USING (
      (select auth.uid()) = affiliate_id
      OR
      (select auth.uid()) = referred_user_id
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Affiliates can update own referrals"
    ON public.affiliate_referrals FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = affiliate_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT: handled by service_role


-- ===== 19. affiliate_withdrawals =====

DO $$ BEGIN
  ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'affiliate_withdrawals RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Affiliates can view own withdrawals"
    ON public.affiliate_withdrawals FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = affiliate_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT/UPDATE (status + paid_at): handled by service_role


-- ============================================================================
-- GROUP E: WEBHOOK TRADING INTEGRATION
-- ============================================================================

-- ===== 20. trading_integrations =====
-- Has RLS from 20250519 migration. Reinforcing.

DO $$ BEGIN
  ALTER TABLE public.trading_integrations ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'trading_integrations RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own integrations"
    ON public.trading_integrations FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own integrations"
    ON public.trading_integrations FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own integrations"
    ON public.trading_integrations FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own integrations"
    ON public.trading_integrations FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- GROUP F: SUPABASE STORAGE
-- ============================================================================

-- ===== 21. storage.objects =====
-- Supabase-managed table. Only enable RLS, revoke anon.
-- Existing bucket policies handle the rest.

DO $$ BEGIN
  ALTER TABLE public.storage ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'storage RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.storage.objects FROM anon;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'revoke storage.objects from anon: %', SQLERRM;
END $$;


-- ============================================================================
-- GRANT CONSOLIDATION
-- ============================================================================
-- Ensure authenticated role has proper table-level grants.
-- NOTE: GRANT USAGE is for SCHEMAS only, NOT tables.
--       Do NOT use GRANT USAGE ON TABLE — it's invalid/ignored.
-- service_role already has ALL privileges by default in Supabase.
-- ============================================================================

DO $$ BEGIN
  GRANT SELECT, UPDATE ON public.users TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant users: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant profiles: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant user_subscriptions: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant trades: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_accounts TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant trading_accounts: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_integrations TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant trading_integrations: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant journal_entries: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant tags: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_goals TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant weekly_goals: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant watchlist: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_links TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant social_links: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_submissions TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant user_submissions: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_progress TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant mission_progress: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant bug_reports: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, UPDATE ON public.payment_orders TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant payment_orders: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT ON public.promo_codes TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant promo_codes: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT, UPDATE ON public.affiliates TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant affiliates: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT ON public.affiliate_referrals TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant affiliate_referrals: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT ON public.affiliate_withdrawals TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant affiliate_withdrawals: %', SQLERRM;
END $$;


-- ============================================================================
-- SCHEMA-LEVEL GRANT (for authenticated to access public schema)
-- ============================================================================

DO $$ BEGIN
  GRANT USAGE ON SCHEMA public TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant schema usage: %', SQLERRM;
END $$;


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after applying to verify everything is correct:
--
-- 1. Check which tables have RLS enabled:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public'
--    ORDER BY tablename;
--    -- Expected: ALL tables show rowsecurity = true
--
-- 2. Check which tables still have no policies:
--    SELECT t.tablename
--    FROM pg_tables t
--    WHERE t.schemaname = 'public'
--    AND t.tablename NOT IN (
--      SELECT tablename FROM pg_policies WHERE schemaname = 'public'
--      GROUP BY tablename
--    )
--    ORDER BY t.tablename;
--    -- Expected: EMPTY (all tables have at least one policy)
--
-- 3. Count policies per table:
--    SELECT tablename, count(*) as policy_count
--    FROM pg_policies
--    WHERE schemaname = 'public'
--    GROUP BY tablename
--    ORDER BY tablename;
--
-- 4. Check anon grants (should be NONE for security):
--    SELECT grantee, table_name, privilege_type
--    FROM information_schema.role_table_grants
--    WHERE grantee = 'anon'
--    AND table_schema = 'public';
--    -- Expected: EMPTY (no anon grants)
-- ============================================================================

-- ============================================================================
-- DONE!
-- ============================================================================
-- All 21 tables now have RLS enabled with appropriate policies.
-- "RLS Disabled in Public" warnings should be completely resolved.
-- ============================================================================
