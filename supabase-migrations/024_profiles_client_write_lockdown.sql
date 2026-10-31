-- ============================================================
-- MIGRASI 024 — HARDENING TABEL profiles: TULISAN CLIENT DITUTUP
-- ============================================================
-- Konteks (temuan hardening terakhir dari audit E2E):
--   1. auth-context.tsx dulu UPDATE is_pro/subscription_status LANGSUNG
--      dari browser — pola yang sama bisa dipakai user nakal untuk
--      self-PRO dari console.
--   2. auth/callback/page.tsx dulu UPSERT profiles dari browser — bisa
--      menyelipkan role/plan/status apa pun ke baris sendiri (mis.
--      role='ADMIN' yang dibaca fallback halaman admin).
--
--   KEDUANYA sudah direfaktor ke jalur service-role (kode terpush
--   SEBELUM migrasi ini jalan — aman dua arah):
--     - /api/auth/ensure-profile  (self-only, role='USER' hardcoded)
--     - auth-context: status PRO expired cukup override di memori;
--       penurunan nyata oleh cron downgrade-expired-pro + isUserPro()
--       yang selalu mengecek tanggal di server
--     - /api/profile/me PATCH (whitelist allowedFields)
--     - /api/auth/sync-profile GET (service-role utk insert/update)
--
-- Efek setelah migrasi: authenticated/anon HANYA bisa SELECT profiles.
-- Semua tulisan legit lewat service_role (bypass RLS, grants tak tersentuh).
--
-- EKSEKUSI: Supabase Dashboard → SQL Editor → Run. (Bos)
-- Idempotent: REVOKE ulang-sama-aman.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM anon;

-- CATATAN:
-- - SELECT sengaja tetap terbuka untuk authenticated (alur auth & dashboard
--   membaca profil sendiri via browser client).
-- - Policies TIDAK dihapus — privilege adalah gerbang luar; policy tanpa
--   privilege tidak pernah menyala. (Prinsip: kalau ragu gausah dihapus.)
-- - service_role tidak tersentuh (dipakai semua route server).

-- ── VERIFIKASI (jalankan di SQL Editor setelah REVOKE) ──
-- HARUS hanya menampilkan baris privilege_type = 'SELECT'
-- untuk anon & authenticated:
--
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND grantee IN ('anon', 'authenticated')
-- ORDER BY grantee, privilege_type;
