-- ============================================================
-- 039 — Instagram CAROUSEL (multi-foto dari Remotion renderStill)
-- ============================================================
-- KONTEKS (aturan Bos: konten HANYA video Remotion + carousel):
--   Pipeline carousel Sinta (CMO): renderStill komposisi
--   SintaCarousel 1080×1350 (PNG per slide) di runner GitHub
--   Actions → upload PNG ke host publik (litterbox 72 jam) →
--   POST /api/cron/ig-carousel-post → antrean instagram_posts
--   dgn media_type='CAROUSEL' → publish via Facebook Page Graph
--   API:
--     per foto : POST /{page-id}/media?image_url=&is_carousel_item=true
--     induk    : POST /{page-id}/media?media_type=CAROUSEL
--                &children=id1,id2,...&caption=
--     publish  : POST /{page-id}/media_publish?creation_id=
--   (lihat src/lib/instagram.ts → createCarouselContainer)
--
--   Slide URL (2–10 .jpg/.png https) disimpan di meta.image_urls
--   (JSONB dari migrasi 038) — TIDAK ada perubahan kolom baru:
--   media_type text cukup utk 'CAROUSEL', image_url/video_url
--   dibiarkan NULL utk baris carousel.
--
-- TABEL INI IDEMPOTENT — aman dijalankan berulang kali.
-- RLS: tetap ENABLE (migrasi 037) — hanya service-role yang boleh akses.
-- ============================================================

-- Pastikan kolom meta jsonb ada (idempotent dgn 038)
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Index cadangan utk cadence "2 hari sekali" carousel terakhir
CREATE INDEX IF NOT EXISTS idx_igposts_carousel_published
  ON public.instagram_posts (published_at DESC)
  WHERE media_type = 'CAROUSEL' AND status = 'published';

-- Index bantu klaim antrean (pending → publishing)
CREATE INDEX IF NOT EXISTS idx_igposts_pending_claim
  ON public.instagram_posts (scheduled_for)
  WHERE status = 'pending';

-- Catatan operasional (komentar tabel)
COMMENT ON TABLE public.instagram_posts IS
  'Antrean auto-post IG: media_type IMAGE (image_url) | REELS (video_url .mp4) | CAROUSEL (meta.image_urls, 2-10 slide PNG 1080x1350 hasil renderStill SintaCarousel). Sumber: manual | sinta-video | sinta-carousel. Aturan Bos: konten HANYA video Remotion + carousel.';
