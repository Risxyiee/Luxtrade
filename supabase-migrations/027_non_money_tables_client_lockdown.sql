-- ============================================================
-- MIGRASI 027 — LOCKDOWN TABEL NON-UANG: 23 TABEL DITUTUP DARI CLIENT
-- (v2 — kebal tabel yang tidak ada, pola 026)
-- ============================================================
-- LANJUTAN MIGRASI 026 (tabel uang). Kini giliran tabel NON-uang yang
-- TIDAK PERLU diakses browser langsung.
--
-- METODE AUDIT (kode sampai commit saat 027 dibuat):
--   Script pemetaan scripts/audit-table-clients.ts memetakan SEMUA
--   akses tabel di src/ ke tipe client-nya:
--     ADMIN = service_role (getSupabaseAdmin/createAdminClient/
--             SUPABASE_SERVICE_ROLE_KEY) — query kebal REVOKE client.
--     USER  = user-JWT (anon key + cookie/Bearer user, jalan sebagai
--             role `authenticated`/`anon` via createClientForApi/
--             getServerClient/createSupabaseClient) — WAJIB keep grant.
--   Pola tambahan yang dicek manual: .from() dinamis (cuma storage
--   bucket + helper tableExists di route server), fetch rest/v1
--   langsung (semua di lib/route server dgn service key), realtime
--   postgres_changes (NOL di seluruh kode), .rpc() (2, semua route
--   server).
--
-- HASIL: dari 48 tabel publik —
--   23 tabel  : SEMUA query lewat service_role → browser tak butuh
--               apa pun → di-REVOKE total (daftar di bawah).
--   25 tabel  : disentuh client user-JWT/anon BY DESIGN (profiles,
--               trades, journal_entries, dll.) → TIDAK disentuh 027;
--               keamanannya = RLS + policy owner-scoped (lihat
--               VERIFIKASI 3 untuk audit).
--   5 tabel uang sudah dikunci 026 (affiliates, withdrawals,
--               payment_orders, user_submissions, affiliate_referrals).
--
-- ⚠️ DUA TEMUAN PENTING YANG DITUTUP 027:
--   1. affiliate_withdrawals — TABEL UANG yang TERLEWAT dari 026!
--      (026 hanya mengunci "withdrawals"; "affiliate_withdrawals"
--      masih pegang GRANT SELECT dari migrasi 2026-07-28).
--   2. user_subscriptions — pegang GRANT UPDATE + policy
--      "Users can update own subscriptions" → user nakal berpotensi
--      mengubah baris langganan sendiri (self-upgrade PRO) langsung
--      via PostgREST. Semua query-nya ternyata service_role → dikunci.
--
-- CATATAN:
--   - Tabel "notifications" TIDAK ADA (yang ada: notification_preferences
--     [KEEP — diakses client utk preferensi notif user] dan
--     push_subscriptions [dikunci 027]).
--   - "screenshots" = STORAGE BUCKET, bukan tabel → di luar 027
--     (audit bucket = item checklist terpisah).
--   - Policies TIDAK di-drop (prinsip: kalau ragu gausah dihapus) —
--     policy tanpa privilege tidak pernah menyala.
--   - service_role TIDAK tersentuh — semua route server tetap jalan.
--   - Idempotent & aman dijalankan ulang (REVOKE = sama-aman).
--
-- EKSEKUSI: Supabase Dashboard → SQL Editor → Run. (Bos)
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tabel_lockdown TEXT[] := ARRAY[
    -- === TABEL UANG YANG TERLEWAT DARI 026 ===
    'affiliate_withdrawals',
    -- === LANGGANAN (ANTI SELF-UPGRADE PRO) ===
    'user_subscriptions',
    -- === GAMIFICATION / KUOTA ===
    'achievements',
    'user_achievements',
    'user_quotas',
    -- === KARYAWAN AI ===
    'agent_kv',
    'ai_pending_actions',
    'ai_pending_tasks',
    'office_memory',
    'tiktok_posts',
    -- === EMAIL / NOTIFIKASI INFRA ===
    'email_broadcasts',
    'weekly_summary_emails',
    're_engagement_emails',
    'daily_reminder_logs',
    'contact_messages',
    -- === KOMUNITAS / KONTEN ===
    'community_trades',
    'blog_posts',
    'bug_reports',
    -- === PINE (SCRIPT RAHASIA + ALERT) ===
    'pine_scripts',
    'pine_alert_log',
    'pine_alert_subscriptions',
    'protected_scripts',  -- sudah dikunci B1; ditegaskan ulang (idempotent)
    -- === PUSH NOTIFICATION TOKEN ===
    'push_subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tabel_lockdown LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated, anon', t);
      RAISE NOTICE 'LOCKED: public.%', t;
    ELSE
      RAISE NOTICE 'SKIP (tabel tidak ada): public.%', t;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- VERIFIKASI 1 — GRANTS SISA PADA 23 TABEL. HARUS KOSONG (0 baris):
-- ============================================================
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'affiliate_withdrawals','user_subscriptions','achievements',
--     'user_achievements','user_quotas','agent_kv','ai_pending_actions',
--     'ai_pending_tasks','office_memory','tiktok_posts',
--     'email_broadcasts','weekly_summary_emails','re_engagement_emails',
--     'daily_reminder_logs','contact_messages','community_trades',
--     'blog_posts','bug_reports','pine_scripts','pine_alert_log',
--     'pine_alert_subscriptions','protected_scripts','push_subscriptions'
--   )
--   AND grantee IN ('anon','authenticated')
-- ORDER BY table_name, grantee, privilege_type;

-- ============================================================
-- VERIFIKASI 2 — RED FLAG: tabel yang MASIH punya grant client
-- tapi RLS OFF (= semua baris terbuka bagi yang pegang grant).
-- HARUS KOSONG (0 baris):
-- ============================================================
-- SELECT t.tablename AS table_name,
--        t.rowsecurity,
--        count(g.privilege_type) AS jumlah_grant_client
-- FROM pg_tables t
-- LEFT JOIN information_schema.role_table_grants g
--        ON g.table_schema = t.schemaname
--       AND g.table_name   = t.tablename
--       AND g.grantee IN ('anon','authenticated')
-- WHERE t.schemaname = 'public'
--   AND t.rowsecurity = false
-- GROUP BY t.tablename, t.rowsecurity
-- HAVING count(g.privilege_type) > 0
-- ORDER BY t.tablename;

-- ============================================================
-- VERIFIKASI 3 — AUDIT RLS TABEL KEEP (25 tabel yang memang
-- diakses client user-JWT/anon BY DESIGN). Jalankan, kirim hasilnya
-- ke Z untuk dicek owner-scoped:
-- ============================================================
-- SELECT tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'profiles','users','trades','trading_accounts',
--     'prop_firm_challenges','prop_firm_rules','journal_entries',
--     'mission_progress','watchlist','tags','targets','goals',
--     'weekly_goals','social_links','testimonials','promo_codes',
--     'trading_integrations','notification_preferences','equity_curve',
--     'referral_tracking'
--   )
-- ORDER BY tablename, cmd, policyname;
--
-- CATATAN VERIFIKASI 3:
--   - Semua policy pada tabel milik-user harus punya kondisi
--     auth.uid() (mis. "(select auth.uid()) = user_id") di qual
--     maupun with_check.
--   - Tabel khusus: promo_codes (SELECT utk authenticated dgn
--     is_active = true), testimonials (butuh SELECT utk anon —
--     landing tamu baca via /api/testimonials dgn client anon).
--   - Tabel KEEP yang tidak muncul sama sekali di pg_policies =
--     policy kosong → kalau RLS ON, client tak bisa apa-apa
--     (fail-closed, biasanya aman); kalau RLS OFF + ada grant =
--     BAHHAYA (tangkap oleh VERIFIKASI 2).
