-- ============================================================
-- MIGRASI 025 — profiles: FINALISASI GRANTS + RLS BACA-BARIS-SENDIRI
-- ============================================================
-- Konteks:
--   Migrasi 024 (sudah dijalankan Bos, terverifikasi) menutup
--   INSERT/UPDATE/DELETE dari authenticated & anon. Output verifikasi
--   menunjukkan masih tersisa 3 privilege untuk authenticated:
--   REFERENCES, TRIGGER, TRUNCATE.
--
--   Migrasi ini membersihkan sisanya (hygiene — nol dampak ke app):
--   1. REFERENCES / TRIGGER / TRUNCATE = privilege DDL/administratif
--      yang TIDAK PERNAH bisa dipanggil lewat Supabase JS / PostgREST.
--      Mencabutnya tidak memengaruhi satu pun alur aplikasi.
--   2. anon: cabut SEMUA privilege. Tidak ada alur tamu yang membaca
--      profiles dari browser — semua pembacaan publik lewat API server
--      (service-role, tak terpengaruh grants/RLS).
--   3. RLS dinyalakan + policy "baca baris sendiri" untuk authenticated.
--      Catatan tipe: profiles.id = TEXT, auth.uid() = UUID → dua-duanya
--      di-cast ::text supaya kebal skema. service_role tidak terpengaruh
--      (BYPASSRLS) — semua route server tetap jalan normal.
--
--   Prinsip "kalau ragu gausah dihapus": policy lama TIDAK dihapus di sini.
--   Kalau verifikasi-2 menunjukkan policy permissive lain (mis.
--   USING (true)), Z yang akan bereskan setelah lihat outputnya.
--
-- EKSEKUSI: Supabase Dashboard → SQL Editor → Run. (Bos)
-- Idempotent: aman dijalankan berulang.

-- ── 1) Bersihkan sisa privilege DDL/administratif ──
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.profiles FROM authenticated;

-- ── 2) Anon: tidak punya akses apa pun ke profiles ──
REVOKE ALL ON TABLE public.profiles FROM anon;

-- ── 3) RLS + policy baca-baris-sendiri ──
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id::text = auth.uid()::text);

-- ============================================================
-- VERIFIKASI (jalankan di SQL Editor, tempel hasilnya ke Z)
-- ============================================================
-- VERIFIKASI 1 — grants: HARUS tinggal SATU baris:
--   authenticated | SELECT
--
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND grantee IN ('anon', 'authenticated')
-- ORDER BY grantee, privilege_type;
--
-- VERIFIKASI 2 — status RLS + daftar policy (untuk review Z):
--
-- SELECT c.relrowsecurity AS rls_on,
--        p.policyname, p.cmd, p.roles, p.qual
-- FROM pg_class c
-- LEFT JOIN pg_policies p
--   ON p.schemaname = 'public' AND p.tablename = c.relname
-- WHERE c.relname = 'profiles';
