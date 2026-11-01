-- ============================================================
-- SQL 20261101 — FIX 23502: affiliates.id tanpa DEFAULT
-- ============================================================
-- Gejala (CF Workers log, level error):
--   GET /api/affiliate/me → 500
--   "null value in column \"id\" of relation \"affiliates\"
--    violates not-null constraint" (23502)
--   Failing row: (null, <user_id>, LUX..., 0, 0, 0, ...)
--
-- Penyebab: route /api/affiliate/me INSERT tanpa kolom `id`
-- (mengandalkan default DB), tapi tabel `affiliates` buatan manual
-- TIDAK punya DEFAULT di kolom id → semua user BARU gagal 500 di
-- halaman affiliate. User lama tidak kena (barisnya sudah ada).
--
-- Perbaikan: pasang DEFAULT gen_random_uuid() sesuai tipe kolom.
-- Idempotent — aman dijalankan berulang.

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name  = 'affiliates'
    AND column_name = 'id';

  IF col_type IS NULL THEN
    RAISE NOTICE 'SKIP: tabel/kolom affiliates.id tidak ditemukan';
  ELSIF col_type = 'uuid' THEN
    EXECUTE 'ALTER TABLE public.affiliates ALTER COLUMN id SET DEFAULT gen_random_uuid()';
    RAISE NOTICE 'OK: affiliates.id (uuid) → DEFAULT gen_random_uuid()';
  ELSIF col_type IN ('text', 'character varying') THEN
    EXECUTE 'ALTER TABLE public.affiliates ALTER COLUMN id SET DEFAULT gen_random_uuid()::text';
    RAISE NOTICE 'OK: affiliates.id (%) → DEFAULT gen_random_uuid()::text', col_type;
  ELSE
    RAISE NOTICE 'SKIP: affiliates.id bertipe % — pasang default manual', col_type;
  END IF;
END $$;

-- ── VERIFIKASI (jalankan terpisah kalau mau lihat hasilnya): ──
-- SELECT column_name, column_default
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='affiliates' AND column_name='id';
-- Harap berisi: gen_random_uuid()  (atau gen_random_uuid()::text)
