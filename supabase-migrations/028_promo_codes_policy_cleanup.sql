-- ============================================================
-- MIGRASI 028 — BERSIHKAN 2 POLICY NAKAL promo_codes
-- Status: SUDAH DIJALANKAN BOS → SUKSES (sisa tepat 3 policy intent)
-- ============================================================
-- Hasil audit 027 VERIFIKASI 3 menemukan 2 policy yang menyalahi
-- intent migrasi 2026-07-28:
--   1. promo_codes_public_read       — USING(true) utk anon+
--      authenticated = siapa pun baca SEMUA kode promo (termasuk
--      nonaktif/expired + kuota). Client tidak pernah baca tabel ini
--      langsung (semua lewat API admin) → di-drop.
--   2. promo_codes_service_role_read — target role 'authenticator'
--      (tidak pernah menjalankan query; service_role sudah bypass
--      RLS) = mati surat → di-drop.
-- Sisa policy yang BENAR (tepat 3):
--   - Admins can manage promo codes        (ALL, role-gated)
--   - Anyone can view active promo codes   (SELECT, is_active=true)
--   - Authenticated users can view active promos (SELECT, is_active)

DO $$
DECLARE
  pol TEXT;
  pols TEXT[] := ARRAY[
    'promo_codes_public_read',
    'promo_codes_service_role_read'
  ];
BEGIN
  IF to_regclass('public.promo_codes') IS NULL THEN
    RAISE NOTICE 'SKIP: public.promo_codes tidak ada';
    RETURN;
  END IF;
  FOREACH pol IN ARRAY pols LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'promo_codes'
        AND policyname = pol
    ) THEN
      EXECUTE format('DROP POLICY %I ON public.promo_codes', pol);
      RAISE NOTICE 'DROPPED: %', pol;
    ELSE
      RAISE NOTICE 'SKIP (policy tidak ada): %', pol;
    END IF;
  END LOOP;
END $$;

-- VERIFIKASI — policy tersisa HARUS tepat 3 (lihat header):
-- SELECT policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'promo_codes'
-- ORDER BY policyname;
