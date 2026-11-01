-- ============================================================
-- 036 — RE-ENGAGEMENT DRIP MULTI-STEP (FASE 5B)
-- ============================================================
-- Konteks (FASE 5B, 2026-10-31):
--   Cron /api/cron/re-engage selama ini cuma 1 langkah (D+1: 24-48 jam
--   setelah daftar). FASE 5B menambah langkah kedua D+7 untuk user yang
--   masih NOL trade → email "cara otomatis" (screenshot AI / auto-import
--   FXBlue/MyFxBook).
--
--   Dua langkah = satu user bisa terima LEBIH DARI SATU email dengan
--   email_type berbeda → tracking re_engagement_emails harus unik per
--   (user_id, email_type), bukan per user_id saja.
--
-- SQL ini:
--   1. Buat tabel kalau belum ada (dulu tidak pernah ada file SQL-nya —
--      route sudah toleran tabel hilang, jadi statusnya di produksi
--      mungkin "belum ada" atau "ada tanpa catatan resmi").
--   2. Lepas constraint/index unique yang HANYA di user_id (kalau ada).
--   3. Pasang unique (user_id, email_type).
--   4. RLS ENABLE tanpa policy → hanya service_role (pola email_broadcasts).
--
-- IDEMPOTENT: aman diulang. Ada NOTICE verifikasi di akhir.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.re_engagement_emails (
  user_id    text NOT NULL,
  email      text,
  email_type text NOT NULL DEFAULT 'no_trade',
  sent_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.re_engagement_emails ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  con         record;
  idx         record;
  col_count   int;
  is_userid   bool;
  unique_ok   bool;
BEGIN
  -- ── 1. Lepas constraint PK/UNIQUE yang hanya mencakup user_id ──
  FOR con IN
    SELECT c.conname, c.conkey
    FROM pg_constraint c
    WHERE c.conrelid = 'public.re_engagement_emails'::regclass
      AND c.contype IN ('p', 'u')
  LOOP
    SELECT count(*), bool_or(a.attname = 'user_id')
      INTO col_count, is_userid
      FROM unnest(con.conkey) AS k
      JOIN pg_attribute a
        ON a.attrelid = 'public.re_engagement_emails'::regclass
       AND a.attnum = k;

    IF col_count = 1 AND is_userid THEN
      EXECUTE format('ALTER TABLE public.re_engagement_emails DROP CONSTRAINT %I', con.conname);
      RAISE NOTICE '→ constraint lama dilepas: %', con.conname;
    END IF;
  END LOOP;

  -- ── 2. Lepas unique index berdiri-sendiri yang hanya di user_id ──
  FOR idx IN
    SELECT i.relname AS idxname
    FROM pg_class t
    JOIN pg_index ix ON ix.indrelid = t.oid
    JOIN pg_class i  ON i.oid = ix.indexrelid
    WHERE t.relname = 're_engagement_emails'
      AND ix.indisunique
      AND ix.indisprimary = false
      AND (SELECT count(*) FROM unnest(ix.indkey) AS k) = 1
      AND (SELECT a.attname FROM unnest(ix.indkey) AS k
           JOIN pg_attribute a
             ON a.attrelid = t.oid AND a.attnum = k
           LIMIT 1) = 'user_id'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.idxname);
    RAISE NOTICE '→ unique index lama dilepas: %', idx.idxname;
  END LOOP;

  -- ── 3. Pasang unique (user_id, email_type) kalau belum ada ──
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 're_engagement_emails'
      AND indexdef ILIKE '%UNIQUE INDEX%(user_id, email_type)%'
  ) INTO unique_ok;

  IF NOT unique_ok THEN
    CREATE UNIQUE INDEX re_engagement_emails_user_type_uidx
      ON public.re_engagement_emails (user_id, email_type);
    RAISE NOTICE '→ unique (user_id, email_type) dipasang';
  END IF;

  -- ── Verifikasi ──
  IF to_regclass('public.re_engagement_emails') IS NOT NULL THEN
    RAISE NOTICE '✅ re_engagement_emails siap — multi-step drip (D+1 & D+7) terkunci 1x/email-type/user';
  ELSE
    RAISE NOTICE '❌ tabel tidak ditemukan — cek error di atas';
  END IF;
END
$$;
