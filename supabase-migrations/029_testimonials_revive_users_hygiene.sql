-- ============================================================
-- MIGRASI 029 — REVIVE FITUR TESTIMONI (POLICY YANG HILANG)
--              + HIGIENE GRANT MATI SURAT TABEL users
-- ============================================================
-- LATAR (audit 027 VERIFIKASI 3 + query diagnosa):
--   testimonials: RLS ON + 14 grant client + 0 policy → SEMUA query
--     client ditolak RLS. Akibatnya di produksi:
--       - POST /api/testimonials (kirim testimoni) = MATI (42501)
--       - DELETE testimoni sendiri              = MATI
--       - GET landing                           = kosong (fallback
--         statis komponen yang tampil)
--     Kode route MEMANG didesain mengandalkan RLS (komentar:
--     "RLS will ensure user can only delete their own") tapi policy
--     TIDAK PERNAH dibuat — migrasi 2026-07-28 hanya GRANT.
--   users: RLS ON + 7 grant client + 0 policy → grant 100% mati
--     surat (RLS tanpa policy = tolak semua). Semua jalur server
--     pakai service_role → REVOKE = NOL dampak fungsional, murni
--     higiene (konsisten filosofi 027: privilege = gerbang luar).
--
-- DESAIN 029 (aman-by-default):
--   1. SELECT  : tamu (anon) + authenticated hanya melihat
--                status='approved'. Testimoni pending TIDAK
--                pernah bocor ke publik.
--   2. INSERT  : hanya baris milik sendiri (auth.uid() = user_id)
--                DAN status WAJIB 'pending' → ANTI-FAKE: user nakal
--                tidak bisa insert langsung status='approved'/
--                'is_featured' via PostgREST (melampaui approval
--                admin). is_featured dibiarkan false.
--   3. DELETE  : hanya baris sendiri.
--   4. PRIVASI EMAIL: route server menyimpan email asli ke kolom
--                user_email. Kalau SELECT table-level, tamu bisa
--                membaca email semua pemberi testimoni (bocor).
--                Solusi: SELECT jadi COLUMN-LEVEL — semua kolom
--                KECUALI user_email. Daftar kolom dibangun DINAMIS
--                dari information_schema (kebal skema berubah).
--                Route GET/POST sudah diubah Z ke select eksplisit
--                (commit bareng migrasi ini).
--   5. anon tidak butuh INSERT/UPDATE/DELETE (tanpa policy write
--                anon) → write grant anon dicabut (higiene).
--   6. service_role TIDAK tersentuh (bypass RLS + full columns) —
--                panel admin testimoni tetap normal.
--   7. Tabel users: REVOKE ALL grant client (mati surat).
--
-- Idempotent (policy dicek dulu sebelum create). Prinsip
-- "kalau ragu gausah dihapus": tidak ada data/policy lain disentuh.
--
-- EKSEKUSI: Supabase Dashboard → SQL Editor → Run. (Bos)
-- ============================================================

-- ============ BAGIAN 1: POLICY TESTIMONIALS ============
DO $$
BEGIN
  IF to_regclass('public.testimonials') IS NULL THEN
    RAISE NOTICE 'SKIP: public.testimonials tidak ada';
  ELSE
    -- 1a. SELECT: hanya yang approved, untuk tamu + user login
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='testimonials'
        AND policyname='Public can view approved testimonials'
    ) THEN
      CREATE POLICY "Public can view approved testimonials"
        ON public.testimonials FOR SELECT
        TO anon, authenticated
        USING (status = 'approved');
      RAISE NOTICE 'CREATED: SELECT policy (approved only)';
    END IF;

    -- 1b. INSERT: milik sendiri + WAJIB pending (anti-fake)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='testimonials'
        AND policyname='Users can submit own pending testimonial'
    ) THEN
      CREATE POLICY "Users can submit own pending testimonial"
        ON public.testimonials FOR INSERT
        TO authenticated
        WITH CHECK (
          (select auth.uid())::text = user_id::text
          AND status = 'pending'
        );
      RAISE NOTICE 'CREATED: INSERT policy (own + pending only)';
    END IF;

    -- 1c. DELETE: hanya baris sendiri
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='testimonials'
        AND policyname='Users can delete own testimonial'
    ) THEN
      CREATE POLICY "Users can delete own testimonial"
        ON public.testimonials FOR DELETE
        TO authenticated
        USING ((select auth.uid())::text = user_id::text);
      RAISE NOTICE 'CREATED: DELETE policy (own only)';
    END IF;
  END IF;
END $$;

-- ============ BAGIAN 2: PRIVASI EMAIL (COLUMN-LEVEL SELECT) ============
-- SELECT table-level dicabut, lalu diberikan per kolom MINUS
-- user_email. Kolom dibaca dinamis → kebal skema berubah.
DO $$
DECLARE
  cols TEXT;
BEGIN
  IF to_regclass('public.testimonials') IS NULL THEN
    RAISE NOTICE 'SKIP: public.testimonials tidak ada';
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'testimonials'
    AND column_name <> 'user_email';  -- kolom privat: tidak pernah ke client

  IF cols IS NULL THEN
    RAISE NOTICE 'SKIP: tidak ada kolom terbaca';
    RETURN;
  END IF;

  EXECUTE 'REVOKE SELECT ON TABLE public.testimonials FROM anon, authenticated';
  EXECUTE format(
    'GRANT SELECT (%s) ON public.testimonials TO anon, authenticated',
    cols
  );
  RAISE NOTICE 'COLUMN-SELECT diberikan (tanpa user_email): %', cols;

  -- Higiene: anon tidak butuh write (tanpa policy write anon)
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
           ON TABLE public.testimonials FROM anon';
  RAISE NOTICE 'Write grant anon dicabut (inert → bersih)';
END $$;

-- ============ BAGIAN 3: HIGIENE TABEL users ============
-- RLS ON + 0 policy = grant client sudah matematis inert.
-- REVOKE = nol dampak, state DB jadi jujur (konsisten 027).
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.users FROM authenticated, anon';
    RAISE NOTICE 'LOCKED (higiene, grant memang inert): public.users';
  ELSE
    RAISE NOTICE 'SKIP (tabel tidak ada): public.users';
  END IF;
END $$;

-- ============================================================
-- VERIFIKASI 1 — policy testimonials HARUS tepat 3:
-- ============================================================
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='testimonials'
-- ORDER BY policyname;

-- ============================================================
-- VERIFIKASI 2 — user_email TIDAK BOLEH muncul (HARUS 0 baris):
-- ============================================================
-- SELECT grantee, table_name, column_name, privilege_type
-- FROM information_schema.column_privileges
-- WHERE table_schema='public' AND table_name='testimonials'
--   AND column_name='user_email'
--   AND grantee IN ('anon','authenticated');

-- ============================================================
-- VERIFIKASI 3 — users: HARUS 0 baris:
-- ============================================================
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema='public' AND table_name='users'
--   AND grantee IN ('anon','authenticated');

-- ============================================================
-- UJI FUNGSIONAL (opsional, dari app):
--   1. Login → submit testimoni dari form landing → harus 201.
--   2. Landing (mode tamu/incognito) → testimoni approved tampil.
--   3. Response API TIDAK mengandung field user_email.
-- ============================================================
