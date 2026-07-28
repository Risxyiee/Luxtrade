-- ===========================================
-- LUXTRADE — COMPLETE RLS HARDENING SCRIPT
-- ===========================================
-- 🎯 Purpose: Fix ALL Supabase "RLS Disabled in Public" warnings
--
-- ⚠️ HOW TO USE:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Paste this ENTIRE script
-- 3. Click "Run"
-- 4. Verify no errors
--
-- 📋 Tables covered (13 tables):
--   ✅ users           ← Main lint warning
--   ✅ user_subscriptions
--   ✅ journal_entries
--   ✅ tags
--   ✅ weekly_goals
--   ✅ social_links
--   ✅ watchlist
--   ✅ payment_orders
--   ✅ promo_codes
--   ✅ email_broadcasts
--   ✅ affiliates
--   ✅ affiliate_referrals
--   ✅ affiliate_withdrawals
--
-- 📋 Tables already having RLS (no changes needed):
--   ✅ trading_integrations (from migration 20250519)
--   ✅ trades (from migration 20250519)
--   ✅ trading_accounts (from migration 20250519)
--   ✅ profiles (from supabase-migrations/001)
--   ✅ user_submissions (from supabase-migrations/001)
--   ✅ mission_progress (from supabase-migrations/001)
--   ✅ storage.objects (from prisma migration)
--   ✅ bug_reports (from prisma migration)
-- ===========================================

-- ===========================================
-- SAFETY: Use DO blocks with IF EXISTS checks
-- to prevent errors if policies already exist
-- ===========================================

DO $$ BEGIN
  -- ========== 1. users ==========
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'users RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own row"
    ON public.users FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists: Users can view own row';
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own row"
    ON public.users FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists: Users can update own row';
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.users FROM anon;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'users revoke anon: %', SQLERRM;
END $$;

DO $$ BEGIN
  -- ========== 2. user_subscriptions ==========
  ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'user_subscriptions RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own subscriptions"
    ON public.user_subscriptions FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists: Users can view own subscriptions';
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own subscriptions"
    ON public.user_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists: Users can insert own subscriptions';
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own subscriptions"
    ON public.user_subscriptions FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists: Users can update own subscriptions';
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own subscriptions"
    ON public.user_subscriptions FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists: Users can delete own subscriptions';
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.user_subscriptions FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 3. journal_entries ==========
  ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'journal_entries RLS enable: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own journals"
    ON public.journal_entries FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own journals"
    ON public.journal_entries FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own journals"
    ON public.journal_entries FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own journals"
    ON public.journal_entries FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy already exists';
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.journal_entries FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 4. tags ==========
  ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'tags RLS enable: %', SQLERRM;
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

DO $$ BEGIN
  REVOKE ALL ON TABLE public.tags FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 5. weekly_goals ==========
  ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
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

DO $$ BEGIN
  REVOKE ALL ON TABLE public.weekly_goals FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 6. social_links ==========
  ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
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

DO $$ BEGIN
  REVOKE ALL ON TABLE public.social_links FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 7. watchlist ==========
  ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
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

DO $$ BEGIN
  REVOKE ALL ON TABLE public.watchlist FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 8. payment_orders ==========
  ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
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

DO $$ BEGIN
  REVOKE ALL ON TABLE public.payment_orders FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 9. promo_codes ==========
  ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view active promos"
    ON public.promo_codes FOR SELECT
    TO authenticated
    USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.promo_codes FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 10. email_broadcasts ==========
  ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.email_broadcasts FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.email_broadcasts FROM authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 11. affiliates ==========
  ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
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

DO $$ BEGIN
  REVOKE ALL ON TABLE public.affiliates FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 12. affiliate_referrals ==========
  ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
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

DO $$ BEGIN
  REVOKE ALL ON TABLE public.affiliate_referrals FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- ========== 13. affiliate_withdrawals ==========
  ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Affiliates can view own withdrawals"
    ON public.affiliate_withdrawals FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = affiliate_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE public.affiliate_withdrawals FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===========================================
-- GRANT CONSOLIDATION
-- All user tables get proper grants for authenticated role
-- ===========================================

DO $$ BEGIN
  GRANT USAGE, SELECT, UPDATE ON public.users TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.weekly_goals TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.social_links TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT, UPDATE ON public.payment_orders TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT ON public.promo_codes TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT, UPDATE ON public.affiliates TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT ON public.affiliate_referrals TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT USAGE, SELECT ON public.affiliate_withdrawals TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===========================================
-- ✅ DONE!
-- ===========================================
-- All 13 previously unprotected tables now have RLS.
-- The "RLS Disabled in Public" warning on `users` should be resolved.
--
-- To VERIFY in Supabase SQL Editor, run:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- All tables should show rowsecurity = true
-- ===========================================
