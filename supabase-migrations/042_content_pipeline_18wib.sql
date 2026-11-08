-- ============================================================
-- 042 — PIPELINE KONTEN SINTA (IG 18–19 WIB, Senin–Jumat)
-- ============================================================
-- Permintaan Bos:
--   1. Posting konten IG (sementara TikTok belum approved) jam
--      18–19 WIB, Senin–Jumat → jadwal di workflow + window di
--      server sudah digeser (tidak perlu SQL).
--   2. Konten Remotion pakai API berbayar (Mortera) → tidak perlu SQL.
--
-- SQL ini = PAKET LENGKAP SATU FILE untuk semua tabel yang
-- dibutuhkan pipeline konten, diambil dari migrasi lama:
--     014 (tiktok_posts — bahan analisa CMO)
--     015 (ai_pending_actions — antrean ACC Bos)
--     037 (ig_token_state + instagram_posts)
--     038 (kolom REELS: media_type/video_url/source/meta)
--     039 (kolom CAROUSEL: meta.image_urls + index)
-- IDEMPOTEN: aman dijalankan berulang kali — tabel/kolom/index
-- yang sudah ada DILEWATI, tidak ada data yang hilang.
--
-- CARA JALANKAN:
--   Supabase Dashboard → SQL Editor → New query → paste semua → Run.
-- ============================================================

-- ── 1) tiktok_posts (014) — katalog konten TikTok bahan riset Sinta ──
CREATE TABLE IF NOT EXISTS public.tiktok_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  caption TEXT,
  thumbnail_url TEXT,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.tiktok_posts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tiktok_posts TO service_role;
CREATE INDEX IF NOT EXISTS idx_tiktok_posts_views ON public.tiktok_posts (views DESC);

-- ── 2) ai_pending_actions (015) — antrean ACC Bos (Kantor CEO) ──────
CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  executed_result JSONB
);
CREATE INDEX IF NOT EXISTS idx_apa_status_created
  ON public.ai_pending_actions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apa_agent_type_created
  ON public.ai_pending_actions (agent_name, action_type, created_at DESC);
ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_pending_actions TO service_role;
GRANT SELECT ON public.ai_pending_actions TO authenticated;

-- ── 3) ig_token_state (037) — token Page IG + umur (auto-refresh 60 hari) ──
CREATE TABLE IF NOT EXISTS public.ig_token_state (
  id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  page_id     text,
  page_token  text,
  issued_at   timestamptz,
  expires_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ig_token_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ig_token_state TO service_role;

-- ── 4) instagram_posts (037+038+039) — ANTREAN posting IG ──────────
CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url     text,                                    -- nullable sejak 038 (baris REELS tak punya foto)
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
-- Kolom REELS + CAROUSEL (038/039 — idempoten utk database lama)
ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'IMAGE';
ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS video_url  text;
ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS source     text NOT NULL DEFAULT 'manual';
ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS meta       jsonb NOT NULL DEFAULT '{}'::jsonb;
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
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.instagram_posts TO service_role;
CREATE INDEX IF NOT EXISTS idx_igposts_pending_claim
  ON public.instagram_posts (scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_igposts_carousel_published
  ON public.instagram_posts (published_at DESC)
  WHERE media_type = 'CAROUSEL' AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_igposts_reels_published
  ON public.instagram_posts (published_at DESC)
  WHERE media_type = 'REELS' AND status = 'published';

-- ── Selesai — cek cepat (opsional, lihat hasil di bawah output) ─────
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='public'
--    AND table_name IN ('tiktok_posts','ai_pending_actions','ig_token_state','instagram_posts');
