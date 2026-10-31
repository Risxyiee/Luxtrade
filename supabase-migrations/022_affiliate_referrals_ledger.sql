-- ══════════════════════════════════════════════════════════════════════════
-- MIGRATION 022 — Ledger affiliate_referrals + dedupe komisi dobel-jalur
-- Tanggal: 2026-02-10
--
-- LATAR (temuan audit E2E — komisi aktivasi):
--   Dua jalur aktivasi admin (/api/admin/activate dan
--   /api/admin/subscriptions/[id]/activate) dulu masing-masing menghitung
--   komisi sendiri, tidak ada yang menulis affiliate_referrals (daftar
--   referral selalu kosong), dan tidak ada dedupe — kedua route untuk
--   aktivasi yang sama = referrer dibayar 2x.
--
--   Kode baru src/lib/affiliate-commission.ts (dipakai KEDUA route) menulis
--   baris ledger affiliate_referrals dengan kolom activation_key =
--   "<userId>:<planType>:<tanggal-aktivasi>"; unique index di bawah memblokir
--   baris kedua → komisi dobel mustahil, bahkan saat race.
--
-- IDEMPOTENT: aman dijalankan berulang.
-- Jalankan di Supabase SQL Editor (pola sama dgn migrasi 020/021).
-- ══════════════════════════════════════════════════════════════════════════

-- ── 0a. Laporan kondisi sekarang (hanya SELECT — aman dijalankan sendiri)
SELECT COUNT(*) AS total_rows FROM public.affiliate_referrals;

-- ── 0b. Pastikan tabel ada (kalau sudah ada → dilewati, struktur lama utuh)
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  subscription_type TEXT,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1. Kolom dedupe (idempotent — kalau kolom sudah ada → no-op)
ALTER TABLE public.affiliate_referrals
  ADD COLUMN IF NOT EXISTS activation_key TEXT;

-- ── 2. Unique index PARSIAL: maksimal 1 ledger per activation_key.
--     Baris lama (activation_key NULL) tetap boleh banyak.
CREATE UNIQUE INDEX IF NOT EXISTS ux_affiliate_referrals_activation
  ON public.affiliate_referrals (activation_key)
  WHERE activation_key IS NOT NULL;

-- ── 3. FK ke affiliates (dibutuhkan embed count di /api/admin/affiliates).
--     DO-block supaya idempotent (PostgreSQL tak punya ADD CONSTRAINT IF NOT
--     EXISTS untuk FK di semua versi yang dipakai).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_affiliate_referrals_affiliate'
      AND conrelid = 'public.affiliate_referrals'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.affiliate_referrals
        ADD CONSTRAINT fk_affiliate_referrals_affiliate
        FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id);
    EXCEPTION WHEN duplicate_object THEN NULL; -- sudah ada (nama lain)
    END;
  END IF;
END $$;

-- ── 4. Index bantu baca daftar referral per affiliate
CREATE INDEX IF NOT EXISTS ix_affiliate_referrals_affiliate
  ON public.affiliate_referrals (affiliate_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- VERIFIKASI (jalankan & periksa hasil):
--   1. Kolom activation_key harus muncul
--   2. ux_affiliate_referrals_activation harus muncul
-- ══════════════════════════════════════════════════════════════════════════

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'affiliate_referrals'
ORDER BY ordinal_position;

SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'affiliate_referrals';
