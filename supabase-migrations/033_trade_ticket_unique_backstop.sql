-- ============================================================
-- 033 — UNIQUE BACKSTOP utk idempotency auto-journal (FASE 2)
-- ============================================================
-- Masalah: auto-journal & wizard melakukan cek duplikat ticket_number
-- dengan pola "read-then-insert". Di bawah beban (atau double-submit),
-- dua request bisa lolos cek bersamaan → trade duplikat.
--
-- Solusi: unique index (user_id, ticket_number) sebagai pengaman
-- tingkat DB (race-proof). Index dibuat HANYA jika data existing
-- bersih (0 duplikat) — kalau ada duplikat, index DI-SKIP dengan
-- NOTICE agar migrasi tidak gagal (prinsip: kalau ragu, jangan
-- rusak — bereskan duplikat dulu, jalankan ulang skrip ini).
--
-- IDEMPOTENT: aman dijalankan berkali-kali.
-- ============================================================

-- ── A. Unique index dengan guard duplikat ─────────────────────────
DO $$
DECLARE
  dup_pairs integer;
BEGIN
  IF to_regclass('public.trades_user_ticket_unique_idx') IS NULL THEN
    -- Hitung pasangan (user_id, ticket_number) yang duplikat
    SELECT COUNT(*) INTO dup_pairs
    FROM (
      SELECT user_id, ticket_number
      FROM public.trades
      WHERE ticket_number IS NOT NULL
        AND btrim(ticket_number) <> ''
      GROUP BY user_id, ticket_number
      HAVING COUNT(*) > 1
    ) d;

    IF dup_pairs = 0 THEN
      CREATE UNIQUE INDEX trades_user_ticket_unique_idx
        ON public.trades (user_id, ticket_number);
      RAISE NOTICE '✅ Unique index trades_user_ticket_unique_idx dibuat (data bersih)';
    ELSE
      RAISE NOTICE '⏭️ SKIPPED: ada % pasangan (user_id, ticket_number) duplikat — bersihkan dulu, lalu jalankan skrip ini lagi', dup_pairs;
      RAISE NOTICE '   Cek duplikat: SELECT user_id, ticket_number, COUNT(*) FROM trades WHERE ticket_number IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1;';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ Index sudah ada — lewati';
  END IF;
END $$;

-- ============================================================
-- V — VERIFIKASI (jalankan terpisah setelah skrip di atas)
-- ============================================================
-- V1. Index harus terdaftar:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'trades' AND indexname = 'trades_user_ticket_unique_idx';
--
--   Hasil diharapkan: 1 baris
--     trades_user_ticket_unique_idx | CREATE UNIQUE INDEX trades_user_ticket_unique_idx
--                                     ON public.trades USING btree (user_id, ticket_number)
--
-- V2. (Opsional) Pastikan tidak ada duplikat yang lolos:
--   SELECT user_id, ticket_number, COUNT(*)
--   FROM trades WHERE ticket_number IS NOT NULL
--   GROUP BY 1,2 HAVING COUNT(*) > 1;
--
--   Hasil diharapkan: 0 baris
-- ============================================================
