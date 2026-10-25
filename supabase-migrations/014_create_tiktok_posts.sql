-- ============================================================
-- 014: Bahan Analisis TikTok untuk CMO
-- CMO (Marketing & Copywriter AI) sebelumnya cuma pegang
-- deskripsi gaya statis di env TIKTOK_REFERENCE. Dengan tabel
-- ini, Bos tinggal paste link TikTok + isi views/likes, dan
-- CMO menganalisis KONTEN ASLI yang terbukti FYP:
--   • caption diambil OTOMATIS via TikTok oEmbed API
--   • CMO pelajari 5 konten dengan views terbantu tiap
--     bikin draf → meniru pola yang TERBUKTI works.
--
-- Jalankan di Supabase Dashboard → SQL Editor → Run.
-- ============================================================

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

-- Semua akses lewat API route (service_role, bypass RLS) —
-- tidak ada policy publik, tabel tetap terkunci dari client.
ALTER TABLE public.tiktok_posts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.tiktok_posts TO service_role;

CREATE INDEX IF NOT EXISTS idx_tiktok_posts_views
  ON public.tiktok_posts (views DESC);
