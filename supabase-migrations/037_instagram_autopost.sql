-- ============================================================
-- 037 — Instagram Auto-Post (Facebook Page Graph API v19.0)
-- ============================================================
-- KONTEKS:
--   Auto-post Instagram via Facebook Page Graph API:
--     1) POST /{page-id}/media?image_url=&caption=  → container id
--     2) POST /{page-id}/media_publish?creation_id= → post id
--   Kode: src/lib/instagram.ts + /api/cron/ig-auto-post +
--   /api/cron/ig-token-refresh + /api/instagram/post (admin).
--
--   Dua tabel:
--   A) ig_token_state  — SINGLETON (id=1): token halaman TERBARU +
--      tanggal terbit. Token 60 hari → di-refresh otomatis lewat
--      fb_exchange_token (butuh FACEBOOK_APP_ID/SECRET). Token hasil
--      refresh DISIMPAN DI SINI (env Cloudflare tidak bisa ditulis
--      runtime) → kode baca DB dulu, env hanya fallback.
--   B) instagram_posts — ANTREAN posting: admin/cron isi baris
--      'pending' → cron publish → 'published' (+ ig_post_id/permalink)
--      atau 'failed' (+ error). attempts utk retry maks 3.
--
-- IDEMPOTENT & SELF-HEALING: aman dijalankan berulang kali.
-- RLS: ENABLE tanpa policy publik → HANYA service-role (admin client)
-- yang bisa baca/tulis (token = rahasia, antrean = internal).
-- ============================================================

-- ── A) State token Instagram (singleton) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.ig_token_state (
  id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- baris tunggal
  page_id     text,
  page_token  text,
  issued_at   timestamptz,                                 -- kapan token diterbitkan
  expires_at  timestamptz,                                 -- issued_at + 60 hari (bisa null = non-expiring)
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── B) Antrean auto-post Instagram ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url     text NOT NULL,                             -- WAJIB URL publik (jpg/png, ≤8MB — syarat IG API)
  caption       text NOT NULL DEFAULT '',                  -- maks 2.200 karakter (limit IG)
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','publishing','published','failed')),
  ig_post_id    text,                                      -- balikan media_publish
  permalink     text,                                      -- URL post IG setelah publish
  error         text,
  attempts      int NOT NULL DEFAULT 0,                    -- maks 3 retry lalu 'failed' permanen
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_igposts_queue
  ON public.instagram_posts (status, scheduled_for)
  WHERE status IN ('pending','publishing');

CREATE INDEX IF NOT EXISTS idx_igposts_published_24h
  ON public.instagram_posts (published_at)
  WHERE status = 'published';

-- ── C) RLS: kunci dari publik (service-role lolos otomatis) ─────────
ALTER TABLE public.ig_token_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama kalau re-run (idempotent)
DROP POLICY IF EXISTS ig_token_state_public_read ON public.ig_token_state;
DROP POLICY IF EXISTS igposts_public_read ON public.instagram_posts;

-- ── D) Singleton token: pastikan baris id=1 ada ─────────────────────
INSERT INTO public.ig_token_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
