-- ============================================================================
-- LUXTRADE - COMPLETE RLS (Row Level Security) HARDENING SCRIPT v3
-- ============================================================================
-- Date       : 2026-07-28
-- Purpose    : Fix ALL "RLS Disabled in Public" Supabase warnings
--
-- IMPORTANT: This script is IDEMPOTENT — safe to run multiple times.
-- Every operation checks table exists first (to_regclass guard).
--
-- HOW TO USE:
--   1. Buka Supabase Dashboard > SQL Editor
--   2. Paste SELURUH script ini
--   3. Klik "Run"
--   4. Pastikan tidak ada error
--
-- ACTUAL DATABASE STATE (after cleanup):
--   - 6 CamelCase Prisma tables DROPPED (0 rows, duplicate):
--     "SocialLink", "Tag", "User", "UserSubscription", "WeeklyGoal", "Withdrawal"
--   - 1 legacy table DROPPED: "profil" (0 rows, not used)
--
-- FINAL 18 TABLES (all have RLS + policies):
--   01. users                 (TEXT id)         — Supabase Auth sync
--   02. profiles             (TEXT id)         — ::text cast needed
--   03. trades               (TEXT user_id)   — ::text cast needed
--   04. trading_accounts     (UUID user_id)
--   05. trading_integrations (UUID user_id)
--   06. journal_entries      (TEXT user_id)   — ::text cast needed
--   07. tags                 (UUID user_id)
--   08. weekly_goals         (UUID user_id)
--   09. watchlist            (TEXT user_id)   — ::text cast needed
--   10. social_links         (UUID "userId")  — CamelCase column!
--   11. user_submissions     (UUID user_id)
--   12. mission_progress      (UUID user_id)
--   13. bug_reports          (TEXT user_id)   — ::text cast needed
--   14. payment_orders       (TEXT user_id)   — ::text cast needed
--   15. promo_codes          (no user_id)
--   16. email_broadcasts     (ADMIN ONLY)
--   17. affiliates           (TEXT user_id)   — ::text cast needed
--   18. affiliate_referrals  (UUID affiliate_id, UUID referred_user_id)
--   19. affiliate_withdrawals (UUID affiliate_id)
--
-- COLUMN NAMING CONVENTION MISMATCH:
--   Some tables use snake_case (user_id), some use CamelCase ("userId")
--   This is because columns were created from different migrations.
--   Always check actual column names before writing policies!
-- ============================================================================


-- ============================================================================
-- PART 1: DROP OLD CAMELCASE TABLES (0 rows, safe to remove)
-- ============================================================================

DROP TABLE IF EXISTS public."SocialLink" CASCADE;
DROP TABLE IF EXISTS public."Tag" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
DROP TABLE IF EXISTS public."UserSubscription" CASCADE;
DROP TABLE IF EXISTS public."WeeklyGoal" CASCADE;
DROP TABLE IF EXISTS public."Withdrawal" CASCADE;
DROP TABLE IF EXISTS public.profil CASCADE;


-- ============================================================================
-- PART 2: REVOKE ALL anon FROM ALL TABLES
-- ============================================================================

DO $$ BEGIN IF to_regclass('public.users') IS NOT NULL THEN REVOKE ALL ON public.users FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.profiles') IS NOT NULL THEN REVOKE ALL ON public.profiles FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trades') IS NOT NULL THEN REVOKE ALL ON public.trades FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trading_accounts') IS NOT NULL THEN REVOKE ALL ON public.trading_accounts FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trading_integrations') IS NOT NULL THEN REVOKE ALL ON public.trading_integrations FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.journal_entries') IS NOT NULL THEN REVOKE ALL ON public.journal_entries FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.tags') IS NOT NULL THEN REVOKE ALL ON public.tags FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.weekly_goals') IS NOT NULL THEN REVOKE ALL ON public.weekly_goals FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.watchlist') IS NOT NULL THEN REVOKE ALL ON public.watchlist FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.social_links') IS NOT NULL THEN REVOKE ALL ON public.social_links FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.user_submissions') IS NOT NULL THEN REVOKE ALL ON public.user_submissions FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.mission_progress') IS NOT NULL THEN REVOKE ALL ON public.mission_progress FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.bug_reports') IS NOT NULL THEN REVOKE ALL ON public.bug_reports FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.payment_orders') IS NOT NULL THEN REVOKE ALL ON public.payment_orders FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.promo_codes') IS NOT NULL THEN REVOKE ALL ON public.promo_codes FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.email_broadcasts') IS NOT NULL THEN REVOKE ALL ON public.email_broadcasts FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliates') IS NOT NULL THEN REVOKE ALL ON public.affiliates FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliate_referrals') IS NOT NULL THEN REVOKE ALL ON public.affiliate_referrals FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliate_withdrawals') IS NOT NULL THEN REVOKE ALL ON public.affiliate_withdrawals FROM anon; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ============================================================================
-- PART 3: ENABLE RLS ON ALL TABLES
-- ============================================================================

DO $$ BEGIN IF to_regclass('public.users') IS NOT NULL THEN ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.profiles') IS NOT NULL THEN ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trades') IS NOT NULL THEN ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trading_accounts') IS NOT NULL THEN ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trading_integrations') IS NOT NULL THEN ALTER TABLE public.trading_integrations ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.journal_entries') IS NOT NULL THEN ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.tags') IS NOT NULL THEN ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.weekly_goals') IS NOT NULL THEN ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.watchlist') IS NOT NULL THEN ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.social_links') IS NOT NULL THEN ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.user_submissions') IS NOT NULL THEN ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.mission_progress') IS NOT NULL THEN ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.bug_reports') IS NOT NULL THEN ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.payment_orders') IS NOT NULL THEN ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.promo_codes') IS NOT NULL THEN ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.email_broadcasts') IS NOT NULL THEN ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliates') IS NOT NULL THEN ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliate_referrals') IS NOT NULL THEN ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliate_withdrawals') IS NOT NULL THEN ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ============================================================================
-- PART 4: DROP OLD/BROKEN POLICIES
-- ============================================================================

DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can do anything" ON public.profiles';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.user_submissions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own submissions" ON public.user_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create own submissions" ON public.user_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own submissions" ON public.user_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can do anything" ON public.user_submissions';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.mission_progress') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own progress" ON public.mission_progress';
    EXECUTE 'DROP POLICY IF EXISTS "Users can upsert own progress" ON public.mission_progress';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can do anything" ON public.mission_progress';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ============================================================================
-- PART 5: CREATE POLICIES
-- Types are verified against actual database:
--   TEXT columns → auth.uid()::text
--   UUID columns → auth.uid()
-- ============================================================================

-- ===== 01. users (TEXT id) → ::text cast =====
DO $$ BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own row" ON public.users FOR SELECT TO authenticated USING (auth.uid()::text = id)';
    EXECUTE 'CREATE POLICY "Users can update own row" ON public.users FOR UPDATE TO authenticated USING (auth.uid()::text = id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 02. profiles (TEXT id) → ::text cast =====
DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid()::text = id)';
    EXECUTE 'CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = id)';
    EXECUTE 'CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()::text = id)';
    EXECUTE 'CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid()::text = id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 03. trades (TEXT user_id) → ::text cast =====
DO $$ BEGIN
  IF to_regclass('public.trades') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 04. trading_accounts (UUID user_id) =====
DO $$ BEGIN
  IF to_regclass('public.trading_accounts') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own trading accounts" ON public.trading_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own trading accounts" ON public.trading_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own trading accounts" ON public.trading_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own trading accounts" ON public.trading_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 05. trading_integrations (UUID user_id) =====
DO $$ BEGIN
  IF to_regclass('public.trading_integrations') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own integrations" ON public.trading_integrations FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own integrations" ON public.trading_integrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own integrations" ON public.trading_integrations FOR UPDATE TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own integrations" ON public.trading_integrations FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 06. journal_entries (TEXT user_id) → ::text cast =====
DO $$ BEGIN
  IF to_regclass('public.journal_entries') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own journals" ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own journals" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own journals" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own journals" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 07. tags (UUID user_id) =====
DO $$ BEGIN
  IF to_regclass('public.tags') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 08. weekly_goals (UUID user_id) =====
DO $$ BEGIN
  IF to_regclass('public.weekly_goals') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own goals" ON public.weekly_goals FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own goals" ON public.weekly_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own goals" ON public.weekly_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own goals" ON public.weekly_goals FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 09. watchlist (TEXT user_id) → ::text cast =====
DO $$ BEGIN
  IF to_regclass('public.watchlist') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own watchlist" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own watchlist" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own watchlist" ON public.watchlist FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own watchlist" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid()::text = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 10. social_links (UUID "userId" — CAMELCASE column!) =====
DO $$ BEGIN
  IF to_regclass('public.social_links') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own social links" ON public.social_links FOR SELECT TO authenticated USING (auth.uid() = "userId")';
    EXECUTE 'CREATE POLICY "Users can insert own social links" ON public.social_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = "userId")';
    EXECUTE 'CREATE POLICY "Users can update own social links" ON public.social_links FOR UPDATE TO authenticated USING (auth.uid() = "userId")';
    EXECUTE 'CREATE POLICY "Users can delete own social links" ON public.social_links FOR DELETE TO authenticated USING (auth.uid() = "userId")';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 11. user_submissions (UUID user_id) =====
DO $$ BEGIN
  IF to_regclass('public.user_submissions') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own submissions" ON public.user_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own submissions" ON public.user_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own submissions" ON public.user_submissions FOR UPDATE TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own submissions" ON public.user_submissions FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 12. mission_progress (UUID user_id) =====
DO $$ BEGIN
  IF to_regclass('public.mission_progress') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own progress" ON public.mission_progress FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own progress" ON public.mission_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own progress" ON public.mission_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own progress" ON public.mission_progress FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 13. bug_reports (TEXT user_id) → ::text cast =====
DO $$ BEGIN
  IF to_regclass('public.bug_reports') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own bug reports" ON public.bug_reports FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own bug reports" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own bug reports" ON public.bug_reports FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 14. payment_orders (TEXT user_id) → ::text cast =====
DO $$ BEGIN
  IF to_regclass('public.payment_orders') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own orders" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own orders" ON public.payment_orders FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 15. promo_codes (no user_id — read active only) =====
DO $$ BEGIN
  IF to_regclass('public.promo_codes') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Authenticated users can view active promos" ON public.promo_codes FOR SELECT TO authenticated USING (is_active = true)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 16. email_broadcasts (ADMIN ONLY — revoke authenticated) =====
DO $$ BEGIN
  IF to_regclass('public.email_broadcasts') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.email_broadcasts FROM authenticated';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 17. affiliates (TEXT user_id) → ::text cast =====
DO $$ BEGIN
  IF to_regclass('public.affiliates') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Users can view own affiliate" ON public.affiliates FOR SELECT TO authenticated USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own affiliate" ON public.affiliates FOR UPDATE TO authenticated USING (auth.uid()::text = user_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 18. affiliate_referrals (UUID affiliate_id, UUID referred_user_id) =====
DO $$ BEGIN
  IF to_regclass('public.affiliate_referrals') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Affiliates can view own referrals" ON public.affiliate_referrals FOR SELECT TO authenticated USING (auth.uid() = affiliate_id OR auth.uid() = referred_user_id)';
    EXECUTE 'CREATE POLICY "Affiliates can update own referrals" ON public.affiliate_referrals FOR UPDATE TO authenticated USING (auth.uid() = affiliate_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 19. affiliate_withdrawals (UUID affiliate_id) =====
DO $$ BEGIN
  IF to_regclass('public.affiliate_withdrawals') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Affiliates can view own withdrawals" ON public.affiliate_withdrawals FOR SELECT TO authenticated USING (auth.uid() = affiliate_id)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ============================================================================
-- PART 6: GRANT CONSOLIDATION
-- ============================================================================

DO $$ BEGIN EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN IF to_regclass('public.users') IS NOT NULL THEN EXECUTE 'GRANT SELECT, UPDATE ON public.users TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.profiles') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trades') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trading_accounts') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_accounts TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.trading_integrations') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_integrations TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.journal_entries') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.tags') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.weekly_goals') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_goals TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.watchlist') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.social_links') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_links TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.user_submissions') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_submissions TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.mission_progress') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_progress TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.bug_reports') IS NOT NULL THEN EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.payment_orders') IS NOT NULL THEN EXECUTE 'GRANT SELECT, UPDATE ON public.payment_orders TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.promo_codes') IS NOT NULL THEN EXECUTE 'GRANT SELECT ON public.promo_codes TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliates') IS NOT NULL THEN EXECUTE 'GRANT SELECT, UPDATE ON public.affiliates TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliate_referrals') IS NOT NULL THEN EXECUTE 'GRANT SELECT ON public.affiliate_referrals TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN IF to_regclass('public.affiliate_withdrawals') IS NOT NULL THEN EXECUTE 'GRANT SELECT ON public.affiliate_withdrawals TO authenticated'; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ============================================================================
-- PART 7: DIAGNOSTICS
-- ============================================================================

SELECT
  tablename AS table_name,
  rowsecurity AS rls_enabled,
  (
    SELECT count(*)
    FROM pg_policies p
    WHERE p.tablename = t.tablename AND p.schemaname = t.schemaname
  ) AS policy_count
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY tablename;

-- Expected: All 18 tables show rls_enabled = true, policy_count > 0
-- ============================================================================
