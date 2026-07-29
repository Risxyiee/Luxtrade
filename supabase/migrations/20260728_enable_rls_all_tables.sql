-- ===========================================
-- COMPREHENSIVE RLS POLICY MIGRATION
-- Date: 2026-07-28
-- Purpose: Enable Row Level Security on ALL public tables
--          that are missing it to fix Supabase lint warnings
--          (especially "RLS Disabled in Public" on users table)
--
-- Rationale:
--   Without RLS, any anon/authenticated role with PostgREST
--   access can potentially CRUD all rows. Enabling RLS is the
--   minimum security baseline for any table in the public schema.
-- ===========================================

-- ===========================================
-- 1. TABLE: users
--    LINT WARNING: "RLS Disabled in Public"
--    Fix: Only the user themselves can see/update their own row.
--    anon gets NO access. service_role bypasses RLS automatically.
-- ===========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Revoke all anon access (should never be able to read/write users)
REVOKE ALL ON TABLE public.users FROM anon;

-- Authenticated user can only see & update their OWN row
CREATE POLICY "Users can view own row"
  ON public.users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own row"
  ON public.users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id);

-- NOTE: INSERT is handled by Supabase Auth automatically.
-- DELETE is intentionally blocked (account deletion via Auth API).

-- ===========================================
-- 2. TABLE: user_subscriptions
--    Fix: Users can CRUD own subscriptions. service_role bypasses.
-- ===========================================

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_subscriptions FROM anon;

CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.user_subscriptions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.user_submissions FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ===========================================
-- 3. TABLE: journal_entries
--    Fix: Users can CRUD own journals. service_role bypasses.
-- ===========================================

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.journal_entries FROM anon;

CREATE POLICY "Users can view own journals"
  ON public.journal_entries FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own journals"
  ON public.journal_entries FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own journals"
  ON public.journal_entries FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own journals"
  ON public.journal_entries FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ===========================================
-- 4. TABLE: tags
--    Fix: Users can CRUD own tags. service_role bypasses.
-- ===========================================

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tags FROM anon;

CREATE POLICY "Users can view own tags"
  ON public.tags FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own tags"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own tags"
  ON public.tags FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own tags"
  ON public.tags FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ===========================================
-- 5. TABLE: weekly_goals
--    Fix: Users can CRUD own goals. service_role bypasses.
-- ===========================================

ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.weekly_goals FROM anon;

CREATE POLICY "Users can view own goals"
  ON public.weekly_goals FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own goals"
  ON public.weekly_goals FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own goals"
  ON public.weekly_goals FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own goals"
  ON public.weekly_goals FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ===========================================
-- 6. TABLE: social_links
--    Fix: Users can CRUD own social links. service_role bypasses.
-- ===========================================

ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.social_links FROM anon;

CREATE POLICY "Users can view own social links"
  ON public.social_links FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own social links"
  ON public.social_links FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own social links"
  ON public.social_links FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own social links"
  ON public.social_links FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ===========================================
-- 7. TABLE: watchlist
--    Fix: Users can CRUD own watchlist items. service_role bypasses.
-- ===========================================

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.watchlist FROM anon;

CREATE POLICY "Users can view own watchlist"
  ON public.watchlist FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own watchlist"
  ON public.watchlist FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own watchlist"
  ON public.watchlist FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own watchlist"
  ON public.watchlist FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ===========================================
-- 8. TABLE: payment_orders
--    Fix: Users can view/update own orders.
--    INSERT/DELETE restricted to service_role (payment system).
-- ===========================================

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_orders FROM anon;

CREATE POLICY "Users can view own orders"
  ON public.payment_orders FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own orders"
  ON public.payment_orders FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- INSERT/DELETE handled by service_role (bypasses RLS automatically)

-- ===========================================
-- 9. TABLE: promo_codes
--    Fix: NO anon access. Authenticated users can only READ
--    active promo codes (to check validity before applying).
--    WRITE (INSERT/UPDATE/DELETE) restricted to service_role.
-- ===========================================

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.promo_codes FROM anon;

CREATE POLICY "Authenticated users can view active promos"
  ON public.promo_codes FOR SELECT
  TO authenticated
  USING (is_active = true);

-- INSERT/UPDATE/DELETE handled by service_role (admin promo management)

-- ===========================================
-- 10. TABLE: email_broadcasts
--     Fix: NO anon access. NO authenticated access.
--     Only service_role (admin) should manage broadcasts.
--     Using RLS to deny all — service_role still bypasses.
-- ===========================================

ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_broadcasts FROM anon;
REVOKE ALL ON TABLE public.email_broadcasts FROM authenticated;

-- No policies for authenticated — service_role bypasses RLS

-- ===========================================
-- 11. TABLE: affiliates
--     Fix: Users can view/update own affiliate record.
--     INSERT/DELETE handled by service_role.
-- ===========================================

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.affiliates FROM anon;

CREATE POLICY "Users can view own affiliate"
  ON public.affiliates FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own affiliate"
  ON public.affiliates FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ===========================================
-- 12. TABLE: affiliate_referrals
--     Fix: Affiliate owners can view their own referrals.
--     Referred users can view their own referral records.
--     INSERT handled by service_role.
-- ===========================================

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.affiliate_referrals FROM anon;

CREATE POLICY "Affiliates can view own referrals"
  ON public.affiliate_referrals FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = affiliate_id
    OR
    (select auth.uid()) = referred_user_id
  );

CREATE POLICY "Affiliates can update own referrals"
  ON public.affiliate_referrals FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = affiliate_id);

-- ===========================================
-- 13. TABLE: affiliate_withdrawals
--     Fix: Affiliate owners can view/update own withdrawals.
--     INSERT handled by service_role.
--     UPDATE (status changes) handled by service_role.
-- ===========================================

ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.affiliate_withdrawals FROM anon;

CREATE POLICY "Affiliates can view own withdrawals"
  ON public.affiliate_withdrawals FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = affiliate_id);

-- UPDATE (paid_at, status) handled by service_role (bypasses RLS)

-- ===========================================
-- GRANT CONSOLIDATION
-- Ensure all user-facing tables have proper grants for authenticated role.
-- service_role already has ALL privileges by default in Supabase.
-- ===========================================

GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.weekly_goals TO authenticated;
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.social_links TO authenticated;
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT USAGE, SELECT, UPDATE ON public.payment_orders TO authenticated;
GRANT USAGE, SELECT ON public.promo_codes TO authenticated;
GRANT USAGE, SELECT, UPDATE ON public.affiliates TO authenticated;
GRANT USAGE, SELECT ON public.affiliate_referrals TO authenticated;
GRANT USAGE, SELECT ON public.affiliate_withdrawals TO authenticated;

-- ===========================================
-- VERIFY: List all tables that should have RLS enabled
-- Run this SELECT to verify after applying:
--
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename NOT IN (
--   SELECT tablename FROM pg_policies WHERE schemaname = 'public'
--   GROUP BY tablename
-- )
-- ORDER BY tablename;
--
-- Expected result: EMPTY (all tables should have RLS)
-- ===========================================
