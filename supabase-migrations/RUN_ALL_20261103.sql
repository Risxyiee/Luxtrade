-- ==================================================================
-- RUN ALL — 3 Nov 2026
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → Run
-- IDEMPOTENT: aman dijalankan berulang kali (tidak akan duplikat)
--
-- Isi:
--   A) Instagram auto-post (migrasi 037+038+039):
--      • ig_token_state  — simpan token halaman FB/IG (refresh 60 hari)
--      • instagram_posts — antrean post: IMAGE | REELS | CAROUSEL
--      • RLS aktif → hanya service-role yang bisa akses
--   B) Kolom yang kurang di profiles & prop_firm_challenges
--      (perbaikan 500 di /api/onboarding/progress & /api/prop-firm-guard)
--   C) notification_log — feed Bell notifikasi in-app
-- ==================================================================

-- ══════════════════════════════════════════════════════════════
-- A) INSTAGRAM AUTO-POST
-- ══════════════════════════════════════════════════════════════

-- A1) State token Instagram (singleton, 1 baris saja)
CREATE TABLE IF NOT EXISTS public.ig_token_state (
  id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  page_id     text,
  page_token  text,
  issued_at   timestamptz,
  expires_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- A2) Antrean auto-post Instagram
CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url     text,
  caption       text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','publishing','published','failed')),
  ig_post_id    text,
  permalink     text,
  error         text,
  attempts      int NOT NULL DEFAULT 0,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- A3) Kolom media (038): REELS + CAROUSEL
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'IMAGE';
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- image_url boleh NULL (baris REELS tidak punya foto)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'instagram_posts'
      AND column_name  = 'image_url'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.instagram_posts ALTER COLUMN image_url DROP NOT NULL;
  END IF;
END $$;

-- A4) Index antrean & riwayat
CREATE INDEX IF NOT EXISTS idx_igposts_queue
  ON public.instagram_posts (status, scheduled_for)
  WHERE status IN ('pending','publishing');

CREATE INDEX IF NOT EXISTS idx_igposts_published_24h
  ON public.instagram_posts (published_at)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_igposts_reels_published
  ON public.instagram_posts (published_at DESC)
  WHERE media_type = 'REELS' AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_igposts_carousel_published
  ON public.instagram_posts (published_at DESC)
  WHERE media_type = 'CAROUSEL' AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_igposts_pending_claim
  ON public.instagram_posts (scheduled_for)
  WHERE status = 'pending';

-- A5) RLS: kunci dari publik (service-role lolos otomatis)
ALTER TABLE public.ig_token_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ig_token_state_public_read ON public.ig_token_state;
DROP POLICY IF EXISTS igposts_public_read ON public.instagram_posts;

-- A6) Singleton token: pastikan baris id=1 ada
INSERT INTO public.ig_token_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- B) KOLOM YANG KURANG (perbaikan 500 produksi)
-- ══════════════════════════════════════════════════════════════

-- B1) Progres checklist onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_steps JSONB DEFAULT '[]'::jsonb;

-- B2) Penanda onboarding selesai
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- B3) Prop firm guard: aturan konsistensi + P/L terbaik sehari
ALTER TABLE public.prop_firm_challenges
  ADD COLUMN IF NOT EXISTS consistency_rule DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.prop_firm_challenges
  ADD COLUMN IF NOT EXISTS best_day_pl DOUBLE PRECISION DEFAULT 0;

-- B4) service_role (admin client API) akses penuh
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.prop_firm_challenges TO service_role;

-- ══════════════════════════════════════════════════════════════
-- C) FEED BELL (notification_log)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notification_log (
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

CREATE INDEX IF NOT EXISTS notification_log_user_created_idx
  ON public.notification_log (user_id, created_at desc);

GRANT ALL ON TABLE public.notification_log TO service_role;

-- ══════════════════════════════════════════════════════════════
-- VERIFIKASI — lihat hasil NOTICE di panel output bawah
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='instagram_posts')
  THEN RAISE NOTICE 'OK instagram_posts'; ELSE RAISE NOTICE 'MISSING instagram_posts'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='ig_token_state')
  THEN RAISE NOTICE 'OK ig_token_state'; ELSE RAISE NOTICE 'MISSING ig_token_state'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='instagram_posts' AND column_name='media_type')
  THEN RAISE NOTICE 'OK instagram_posts.media_type'; ELSE RAISE NOTICE 'MISSING media_type'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles' AND column_name='onboarding_steps')
  THEN RAISE NOTICE 'OK profiles.onboarding_steps'; ELSE RAISE NOTICE 'MISSING onboarding_steps'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='prop_firm_challenges' AND column_name='consistency_rule')
  THEN RAISE NOTICE 'OK consistency_rule'; ELSE RAISE NOTICE 'MISSING consistency_rule'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='notification_log')
  THEN RAISE NOTICE 'OK notification_log'; ELSE RAISE NOTICE 'MISSING notification_log'; END IF;
END $$;
