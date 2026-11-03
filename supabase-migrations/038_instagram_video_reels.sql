-- ============================================================
-- 038 — Instagram VIDEO / REELS (video Reels dari Remotion)
-- ============================================================
-- KONTEKS:
--   Pipeline video Sinta (CMO): render Remotion 9:16 (GitHub Actions)
--   → upload MP4 ke host publik → POST /api/cron/ig-video-post
--   → antrean instagram_posts dgn media_type='REELS' → publish via
--   POST /{page-id}/media?media_type=REELS&video_url=&caption= →
--   /media_publish?creation_id= (lihat src/lib/instagram.ts).
--
--   Perubahan skema (IDEMPOTENT — aman dijalankan berulang):
--     A) instagram_posts.media_type : 'IMAGE' (default, data lama) | 'REELS'
--     B) instagram_posts.video_url  : URL publik .mp4 (wajib utk REELS)
--     C) instagram_posts.image_url  : jadi NULLABLE (baris REELS tak punya foto)
--     D) instagram_posts.source     : 'manual' (default) | 'sinta-video'
--     E) instagram_posts.meta       : JSONB (template, hook, data konten)
--
-- RLS: tetap ENABLE (migrasi 037) — hanya service-role yang boleh akses.
-- ============================================================

-- ── A) media_type ───────────────────────────────────────────────────
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'IMAGE';

-- ── B) video_url ────────────────────────────────────────────────────
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS video_url text;

-- ── C) image_url boleh NULL (baris REELS tidak punya foto) ─────────
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

-- ── D) source (asal baris antrean) ─────────────────────────────────
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- ── E) meta (konteks konten: template, hook, dsb) ──────────────────
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── Index cadangan utk cadence "2 hari sekali" (Reels terakhir) ────
CREATE INDEX IF NOT EXISTS idx_igposts_reels_published
  ON public.instagram_posts (published_at DESC)
  WHERE media_type = 'REELS' AND status = 'published';
