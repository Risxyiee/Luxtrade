-- ============================================================
-- FIX CEPAT: "permission denied for table protected_scripts"
-- (error di Cloudflare log: GET /api/compile-pine)
-- ============================================================
-- Penyebab: tabel protected_scripts & pine_alert_log dibuat
-- TANPA GRANT ke service_role — server (service role) jadi tidak
-- punya izin SELECT/INSERT walau key-nya benar.
--
-- CARA PAKAI: Supabase Dashboard → SQL Editor → paste → Run.
-- IDEMPOTENT: aman dijalankan berulang.
-- ============================================================

grant select, insert, update, delete on public.protected_scripts to service_role;
grant select, insert, update, delete on public.pine_alert_log    to service_role;

-- Verifikasi cepat (harus mengembalikan baris skrip, bukan error):
-- select slug, name, is_active from public.protected_scripts order by sort_order;
