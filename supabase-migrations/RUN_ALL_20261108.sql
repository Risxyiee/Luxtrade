-- ==================================================================
-- RUN ALL — 8 Nov 2026  (paket: 042 + 043 + 044 + 045)
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → Run
-- IDEMPOTEN: aman dijalankan berulang kali (yang sudah ada dilewati)
--
-- Jawaban untuk Bos: "mana sqlnya?"
--   Kalau terakhir menjalankan SQL 041 (market alerts) + RUN_ALL
--   3 Nov, maka YANG BELUM masuk database adalah 4 file ini.
--   Yang paling penting: 043 → tabel growth_leads (tadi 404 di log
--   Cloudflare karena tabelnya memang belum dibuat).
--
-- Isi:
--   042 — Pipeline konten Sinta: tiktok_posts, ai_pending_actions,
--         ig_token_state, instagram_posts (konsolidasi 014-039)
--   043 — growth_leads: jejak lead dari CS bot proaktif (Kevin)
--   044 — Kolom kesehatan evaluasi Pine (last_eval_at/ok/error)
--   045 — ig_comment_hunts: jejak Pemburu Komentar IG (dedupe)
--   046 — blog_posts JARING PENGAMAN: buat tabel bila belum ada +
--         kolom slug/meta_description/keyword/views (040) — log CF
--         8 Nov: GET /rest/v1/blog_posts?select=slug → 400 karena
--         tabel/kolom ini memang belum ada di database.
--
-- Tanpa 043: lead email tidak tersimpan + metrik sentinel 400/404.
-- Tanpa 045: Pemburu Komentar balik "skipped" tiap cron.
-- Tanpa 044: dialog alert Pine tidak menampilkan bukti evaluasi.
-- Tanpa 046: SEO Factory (Farhan) gagal insert + halaman /blog 400.
-- ==================================================================

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

-- ============================================================
-- 043: GROWTH LEADS — Jejak lead dari CS Bot Proaktif (landing)
-- ------------------------------------------------------------
-- Konteks: karyawan AI kini kerja SAAT ZERO-TRAFFIC (Growth
-- Sentinel, karyawan Kevin). CS bot di landing page tidak lagi
-- cuma nunggu ditanya — dia PROAKTIF menyapa (hook harian dari
-- sentinel) dan menawarkan "sinyal harian gratis". Visitor yang
-- tertarik meninggalkan email → tersimpan DI SINI.
--
-- Alur lead:
--   1. CS bot landing /api/chat mendeteksi email di pesan visitor
--      → INSERT baris status 'new' (dedupe per email).
--   2. Sentinel /api/cron/growth-sentinel ambil lead 'new'
--      → LLM racik email welcome personal → draf masuk
--      ai_pending_actions (ACC Bos → Resend via execute-action
--      GROWTH_WELCOME_EMAIL) → status jadi 'emailed'.
--   3. Kalau lead nanti daftar akun (signup), COO-agent/Bagas
--      bisa tandai 'converted' (opsional, manual/SQL).
--
-- Jalankan di Supabase Dashboard → SQL Editor (sekali saja).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.growth_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Email lead (lowercase saat insert oleh API) — UNIK utk dedupe
  email TEXT NOT NULL UNIQUE,
  -- Sumber lead: 'cs-bot' (landing chat) | 'cs-support' (dashboard guest)
  source TEXT NOT NULL DEFAULT 'cs-bot',
  -- Bahasa percakapan saat lead masuk
  language TEXT NOT NULL DEFAULT 'id',
  -- Pesan pertama visitor (konteks buat LLM racik email welcome personal)
  first_message TEXT,
  -- Ringkasan singkat percakapan (diisi sentinel saat draf dibuat)
  notes TEXT,
  -- 'new'      → belum dihubungi (target sweep sentinel)
  -- 'drafted'  → draf email welcome sudah masuk antrean ACC Bos
  -- 'emailed'  → email welcome terkirim (Resend sukses)
  -- 'converted'→ lead daftar akun Luxtradee
  -- 'closed'   → tidak layak ditindak (duplicate/unreachable)
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'drafted', 'emailed', 'converted', 'closed')),
  -- Session id chat (audit + anti-spam: 1 sesi bisa claim beberapa email beda → dibatasi API)
  session_id TEXT,
  -- User agent ringkas (analisis sumber trafik — mobile/desktop)
  ua_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sweep sentinel: ambil lead 'new' terbaru dulu
CREATE INDEX IF NOT EXISTS idx_growth_leads_status_created
  ON public.growth_leads (status, created_at DESC);

-- Laporan harian sentinel: lead masuk hari ini (per hari WIB)
CREATE INDEX IF NOT EXISTS idx_growth_leads_created
  ON public.growth_leads (created_at DESC);

-- ============================================================
-- RLS: tabel hanya lewat API server (service role menembus RLS).
-- Tidak ada policy publik → anon/authenticated TIDAK bisa baca
-- daftar email lead (PII). Insert dilakukan service role di API
-- (bukan dari browser) supaya tak bisa dipenuhi spam dari luar.
-- ============================================================
ALTER TABLE public.growth_leads ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRANTS (pola migrasi 015/041 — tanpa ini service_role kena
-- 42501 "permission denied for table" karena RLS bukan grant)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_leads TO service_role;
GRANT SELECT ON public.growth_leads TO authenticated;

-- updated_at otomatis
CREATE OR REPLACE FUNCTION public.touch_growth_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_growth_leads_touch ON public.growth_leads;
CREATE TRIGGER trg_growth_leads_touch
  BEFORE UPDATE ON public.growth_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_growth_leads_updated_at();

-- ============================================================
-- 044 — PINE EVAL HEALTH (bukti nyata "skrip beneran jalan")
-- ============================================================
-- KONTEKS (keluhan Bos 2026-11): "ini pine script beneran bekerja
-- ga si? masa saya masukin pine script sendiri, sinyal yang dikirim
-- bukan dari pine script saya" — akar masalahnya BUKAN engine-nya
-- palsu (runner GHA tiap 5 menit beneran mengeksekusi skrip user
-- lewat engine Pine), tapi:
--   1. Hasil evaluasi (ok / gagal compile + alasannya) cuma terlihat
--      di log GHA — user TIDAK PERNAH melihatnya → skrip yang gagal
--      compile terasa "tidak jalan sama sekali".
--   2. Push sinyal Pine memakai judul generik (ENTRY_LONG — XAUUSD)
--      tanpa nama skrip → sinyal dari skrip sendiri tidak bisa
--      dibedakan dari sinyal bawaan.
-- Migrasi ini menambah 3 kolom kesehatan per langganan supaya UI
-- bisa menampilkan BUKTI: kapan skrip terakhir dievaluasi runner,
-- hasilnya ok/gagal, dan pesan error engine yang sebenarnya.
--
-- SEBELUM migrasi dijalankan: sistem tetap jalan — semua UPDATE
-- kolom health di kode dibungkus try/catch (pola last_trigger_at).
--
-- IDEMPOTENT — aman dijalankan berulang kali.
-- ============================================================

ALTER TABLE public.pine_alert_subscriptions
  ADD COLUMN IF NOT EXISTS last_eval_at timestamptz;
ALTER TABLE public.pine_alert_subscriptions
  ADD COLUMN IF NOT EXISTS last_eval_ok boolean;
ALTER TABLE public.pine_alert_subscriptions
  ADD COLUMN IF NOT EXISTS last_eval_error text;

COMMENT ON COLUMN public.pine_alert_subscriptions.last_eval_at IS
  'Waktu terakhir grup (script, symbol, timeframe) ini dievaluasi runner alert (GHA 5 menit / cron CF 15 menit / tombol tes). Migrasi 044.';
COMMENT ON COLUMN public.pine_alert_subscriptions.last_eval_ok IS
  'Hasil evaluasi terakhir: TRUE = skrip beneran dieksekusi engine tanpa error; FALSE = gagal (lihat last_eval_error); NULL = belum pernah dievaluasi. Migrasi 044.';
COMMENT ON COLUMN public.pine_alert_subscriptions.last_eval_error IS
  'Pesan error engine evaluasi terakhir (mis. compile error Pine user) — maks 300 karakter. NULL saat ok. Migrasi 044.';

-- GRANT mengikuti migrasi 019/015b: service_role ALL; client tidak
-- boleh menulis kolom health (hanya server cron yang menulis).
GRANT SELECT (last_eval_at, last_eval_ok, last_eval_error)
  ON public.pine_alert_subscriptions TO authenticated;

-- ============================================================
-- 045: IG COMMENT HUNTS — Jejak "PEMBURU KOMENTAR" (karyawan AI)
-- ------------------------------------------------------------
-- Konteks: karyawan AI baru bertugas memantau KOMENTAR di
-- postingan Instagram milik sendiri (patuh ToS: HANYA komentar
-- pada media milik sendiri, via Graph API resmi — bukan scraping,
-- bukan komentar ke akun orang lain).
--
-- Alur hunt (cron /api/cron/comment-hunter, numpang slot 15 menit
-- dgn throttle internal — hunt beneran maks tiap 2 jam):
--   1. Graph API: daftar media terakhir akun IG kita + komentar
--      di tiap media.
--   2. Komentar BARU (comment_id belum ada di tabel ini) →
--      diklasifikasi niatnya (tanya-cara / minat-harga /
--      tanya-sinyal / sapa-halo / pujian / negatif-spam / lain).
--   3. Yang aman → dibalas otomatis via POST /{comment-id}/replies
--      (kuota ketat: maks 5/run, 15/hari WIB) → status
--      'auto_replied'. Sisanya draf ('drafted') untuk ACC Bos,
--      spam dilewati ('skipped'), gagal kirim ('failed').
--   4. 'minat-harga' ditandai lead_flag=true → dilapor ke Bos via
--      Discord (propek berminat beli).
--
-- Dedupe: comment_id UNIK — komentar yang sama tidak pernah
-- diproses dua kali walau cron jalan berulang / isolate CF ganti.
--
-- Jalankan di Supabase Dashboard → SQL Editor (sekali saja).
-- IDEMPOTENT: aman dijalankan berulang (IF NOT EXISTS di semua
-- objek, GRANT/REVOKE/COMMENT tidak error saat diulang).
-- ============================================================

-- 1) Tabel jejak hunt (no-op kalau sudah ada)
CREATE TABLE IF NOT EXISTS public.ig_comment_hunts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ID media/postingan IG tempat komentar muncul
  media_id text NOT NULL,
  -- Link postingan (biar Bos bisa langsung buka dari laporan)
  permalink text,
  -- ID komentar IG — UNIK, kunci dedupe antar-run
  comment_id text NOT NULL,
  -- Username pengomentar (tanpa @, apa adanya dari Graph API)
  username text,
  -- Isi komentar mentah
  comment_text text,
  -- Hasil klasifikasi niat: tanya-cara | minat-harga | tanya-sinyal
  -- | sapa-halo | pujian | negatif-spam | lain
  intent text NOT NULL DEFAULT 'lain',
  -- Draf balasan (template otomatis / hasil LLM untuk ACC Bos)
  reply_text text,
  -- 'auto_replied' → sudah dibalas otomatis via Graph API
  -- 'drafted'     → draf menunggu ACC Bos (atau kuota balasan habis)
  -- 'skipped'     → sengaja tidak dibalas (negatif-spam/lain polos)
  -- 'failed'      → percobaan balas otomatis gagal (reply_text tetap draf)
  status text NOT NULL DEFAULT 'drafted'
    CHECK (status IN ('auto_replied', 'drafted', 'skipped', 'failed')),
  -- true bila intent 'minat-harga' → propek, masuk laporan Discord
  lead_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz
);

-- 2) Kunci dedupe: satu komentar hanya diproses sekali seumur hidup
CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_comment_hunts_comment
  ON public.ig_comment_hunts (comment_id);

-- 3) Laporan/ringkasan per waktu (terbaru dulu)
CREATE INDEX IF NOT EXISTS idx_ig_comment_hunts_created
  ON public.ig_comment_hunts (created_at DESC);

-- 4) Cari cepat jejak per media (debug/audit per postingan)
CREATE INDEX IF NOT EXISTS idx_ig_comment_hunts_media
  ON public.ig_comment_hunts (media_id, created_at DESC);

-- ============================================================
-- RLS: tabel internal karyawan AI — TIDAK ADA policy publik.
-- Browser/aplikasi klien (anon/authenticated) TIDAK boleh baca
-- isi komentar pengguna (privasi) maupun draf balasan.
-- Semua akses hanya lewat API server (service_role menembus RLS).
-- ============================================================
ALTER TABLE public.ig_comment_hunts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRANTS (pola migrasi 043 — tanpa ini service_role kena 42501
-- "permission denied for table" karena RLS bukan grant).
-- Berbeda dari 043: tabel internal → anon/authenticated TIDAK
-- dapat apa pun (tidak ada GRANT + REVOKE tegas utk berjaga-jaga
-- kalau default privileges project memberi hak bawaan).
-- ============================================================
GRANT ALL PRIVILEGES ON public.ig_comment_hunts TO service_role;
REVOKE ALL ON public.ig_comment_hunts FROM anon, authenticated;

-- ============================================================
-- Dokumentasi skema (muncul di Table Editor / introspeksi)
-- ============================================================
COMMENT ON TABLE public.ig_comment_hunts IS
  'Jejak PEMBURU KOMENTAR: komentar IG di postingan milik sendiri (Graph API resmi) yang diklasifikasi niatnya, dibalas otomatis bila aman (kuota ketat), dan dilaporkan ke Bos bila propek. Dedupe per comment_id — jalankan cron /api/cron/comment-hunter.';

COMMENT ON COLUMN public.ig_comment_hunts.comment_id IS
  'ID komentar IG — unik, kunci dedupe antar-run cron.';

COMMENT ON COLUMN public.ig_comment_hunts.intent IS
  'Niat komentar: tanya-cara | minat-harga (lead) | tanya-sinyal | sapa-halo | pujian | negatif-spam | lain.';

COMMENT ON COLUMN public.ig_comment_hunts.status IS
  'auto_replied = dibalas otomatis; drafted = draf nunggu ACC Bos; skipped = sengaja tak dibalas (spam/lain); failed = kirim balasan gagal.';

COMMENT ON COLUMN public.ig_comment_hunts.lead_flag IS
  'true = propek (minat beli) → masuk laporan Discord Bos.';

COMMENT ON COLUMN public.ig_comment_hunts.replied_at IS
  'Waktu balasan otomatis berhasil dikirim (null bila belum/bukan auto_replied).';

-- ============================================================
-- 046 — BLOG_POSTS JARING PENGAMAN (tabel + kolom SEO 040)
-- ------------------------------------------------------------
-- BUKTI DARI LOG Cloudflare 8 Nov 2026:
--   GET https://...supabase.co/rest/v1/blog_posts?select=slug&limit=1000
--   → HTTP 400 (dipanggil SEO Factory Farhan tiap cron, dan
--     halaman /blog).
-- Penyebab: tabel blog_posts BELUM ADA (atau ada tapi tanpa kolom
-- slug dari migrasi 040 yang belum dijalankan). Paket ini meliputi
-- KEDUA kemungkinan sekaligus:
--   a) tabel belum ada     → CREATE TABLE buat utuh (skema 015b)
--   b) tabel ada, kolom 040 belum ada → ADD COLUMN IF NOT EXISTS
--      + backfill slug dari judul (logika sama dgn migrasi 040)
-- IDEMPOTENT: aman dijalankan berulang kali, data lama TIDAK hilang.
-- ============================================================

-- 1) Tabel inti (bila benar-benar belum ada — skema asli 015b)
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  author TEXT NOT NULL DEFAULT 'Sinta (CMO — AI Agent)',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Kolom SEO (migrasi 040) — no-op kalau sudah ada
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS keyword TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

-- 3) Backfill slug dari judul (hanya baris yang slug-nya kosong —
--    rumus identik dengan slugify() di kode: lowercase, bukan a-z0-9 → '-')
UPDATE public.blog_posts
SET slug = regexp_replace(
  lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', '-', 'g')),
  '^-+|-+$', '', 'g')
WHERE slug IS NULL OR slug = '';

-- 4) Dedup slug (judul mirip → suffix 6 karakter id) — WAJIB sebelum
--    index unik, kalau tidak CREATE INDEX bisa gagal
UPDATE public.blog_posts b
SET slug = dups.slug || '-' || substr(replace(b.id::text, '-', ''), 1, 6)
FROM (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.blog_posts
  WHERE slug IS NOT NULL AND slug <> ''
) dups
WHERE b.id = dups.id AND dups.rn > 1;

-- 5) Slug unik (URL /blog/<slug> deterministik)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug
  ON public.blog_posts (slug);

-- 6) RLS + GRANT (pola 015b: blog PUBLIK — semua boleh baca,
--    tulis hanya lewat API server)
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.blog_posts TO service_role;
GRANT SELECT ON public.blog_posts TO authenticated, anon;

COMMENT ON COLUMN public.blog_posts.slug IS
  'URL slug SEO (migrasi 040) — diisi Farhan saat insert, backfill dari judul, unik.';
COMMENT ON COLUMN public.blog_posts.views IS
  'Jumlah pembukaan artikel (increment oleh /api/blog/posts/[slug]). Dipakai learning loop Farhan.';

-- Cek cepat setelah Run (harus mengembalikan 1 baris):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='blog_posts'
--    AND column_name IN ('slug','meta_description','keyword','views');
