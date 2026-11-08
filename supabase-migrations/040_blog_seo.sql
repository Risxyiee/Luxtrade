-- ============================================================
-- 040 — Blog SEO & VIEW COUNTER (kolom baru di blog_posts)
-- ============================================================
-- KONTEKS (skill karyawan maksimal — agent Farhan/Growth Hacker):
--   Sebelumnya Farhan auto-terbit artikel tiap hari ke blog_posts, TAPI:
--   1. meta_description/keyword dihitung lalu DIBUANG (kolom tidak ada)
--   2. tidak ada slug → URL SEO-friendly mustahil
--   3. tidak ada views → Farhan tidak bisa belajar artikel mana yang rame
--   4. halaman /blog hard-coded statis (diperbaiki di kode + API publik
--      /api/blog/posts)
--
-- Migrasi ini menambah 4 kolom + backfill slug + index unik + backfill
-- views dari counter fallback agent_kv (blog_views:<id>) yang dipakai
-- sebelum migrasi dijalankan.
--
-- SEBELUM migrasi: sistem tetap jalan (insert Farhan resilient + API
-- fallback agent_kv 'blog_seo:<id>'). SESUDAH migrasi: SEO tersimpan
-- langsung di baris blog_posts.
--
-- IDEMPOTENT — aman dijalankan berulang kali.
-- ============================================================

-- 1) Kolom SEO + views
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS keyword TEXT;
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

-- 2) Backfill slug dari judul (deterministik, sama dgn slugify() di kode:
--    lowercase, non-alnum → dash, trim dash)
UPDATE public.blog_posts
SET slug = regexp_replace(
              regexp_replace(
                regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'),
                '^-+|-+$', '', 'g'),
              '-{2,}', '-', 'g')
WHERE slug IS NULL OR slug = '';

-- 3) Dedup slug (artikel judul mirip → suffix 6 karakter id) — WAJIB
--    sebelum unique index
WITH dups AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.blog_posts
  WHERE slug IS NOT NULL AND slug <> ''
)
UPDATE public.blog_posts b
SET slug = dups.slug || '-' || substr(replace(b.id::text, '-', ''), 1, 6)
FROM dups
WHERE b.id = dups.id AND dups.rn > 1;

-- 4) Slug unik (URL /blog/<slug> deterministik)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug
  ON public.blog_posts (slug);

-- 5) Backfill views dari counter fallback agent_kv (dipakai sebelum
--    migrasi). Dibungkus DO — agent_kv belum ada? lanjut saja.
DO $$
BEGIN
  UPDATE public.blog_posts b
  SET views = COALESCE(NULLIF(kv.value, '')::int, b.views)
  FROM public.agent_kv kv
  WHERE kv.key = 'blog_views:' || b.id::text
    AND COALESCE(NULLIF(kv.value, '')::int, 0) > b.views;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6) Index bantu: artikel populer (learning loop Farhan) & terbaru
CREATE INDEX IF NOT EXISTS idx_blog_posts_views
  ON public.blog_posts (views DESC)
  WHERE status = 'published';

-- 7) GRANT tetap (migrasi 015b): service_role ALL, anon/authenticated SELECT.
--    RLS ENABLE tetap — publik membaca lewat API service-role, bukan anon.

COMMENT ON COLUMN public.blog_posts.slug IS
  'URL slug SEO (migrasi 040) — diisi Farhan saat insert, backfill dari judul, unik.';
COMMENT ON COLUMN public.blog_posts.views IS
  'Jumlah pembukaan artikel (increment oleh /api/blog/posts/[slug]). Dipakai learning loop Farhan.';
