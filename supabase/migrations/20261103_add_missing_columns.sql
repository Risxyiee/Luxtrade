-- ============================================================================
-- Migration: 20261103 — Tambah kolom yang diminta aplikasi (belum ada di DB)
-- Sumber laporan: log produksi Cloudflare (42703 undefined column)
--   1. column profiles.onboarding_steps does not exist   → GET /api/onboarding/progress
--   2. column prop_firm_challenges.consistency_rule does not exist
--        → GET /api/prop-firm-guard (dulu cuma di-retry dengan kolom minimal)
-- Idempotent — aman dijalankan berulang kali.
-- Cara pakai: Supabase Dashboard → SQL Editor → paste → Run.
-- Bisa juga lewat Admin Panel → tombol "DB Health" → Copy SQL (SQL-nya sama).
-- ============================================================================

-- 1) Progres checklist onboarding (array step ID yang selesai)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_steps JSONB DEFAULT '[]'::jsonb;

-- 2) Penanda onboarding selesai (auto stop buka tab onboarding tiap login)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- 3) Prop firm guard: aturan konsistensi + P/L terbaik sehari
ALTER TABLE public.prop_firm_challenges
  ADD COLUMN IF NOT EXISTS consistency_rule DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.prop_firm_challenges
  ADD COLUMN IF NOT EXISTS best_day_pl DOUBLE PRECISION DEFAULT 0;

-- 4) Pastikan service_role (admin client API) punya akses penuh
--    (RLS user-side tidak berubah — policy owner-only tetap berlaku)
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.prop_firm_challenges TO service_role;

-- 5) (Bonus) pastikan feed notifikasi in-app ada — dulu juga bikin warn log
--    kalau tabel ini belum dibuat. Idempotent.
create table if not exists public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    text        not null,
  title      text        not null,
  body       text,
  type       text,
  url        text,
  tag        text,
  read       boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notification_log_user_created_idx
  on public.notification_log (user_id, created_at desc);
GRANT ALL ON TABLE public.notification_log TO service_role;

-- ===== Verifikasi =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles' AND column_name='onboarding_steps')
  THEN RAISE NOTICE 'OK profiles.onboarding_steps'; ELSE RAISE NOTICE 'MISSING profiles.onboarding_steps'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles' AND column_name='onboarding_completed')
  THEN RAISE NOTICE 'OK profiles.onboarding_completed'; ELSE RAISE NOTICE 'MISSING profiles.onboarding_completed'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='prop_firm_challenges' AND column_name='consistency_rule')
  THEN RAISE NOTICE 'OK prop_firm_challenges.consistency_rule'; ELSE RAISE NOTICE 'MISSING consistency_rule'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='prop_firm_challenges' AND column_name='best_day_pl')
  THEN RAISE NOTICE 'OK prop_firm_challenges.best_day_pl'; ELSE RAISE NOTICE 'MISSING best_day_pl'; END IF;
END $$;
