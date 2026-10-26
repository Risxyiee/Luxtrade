-- ============================================================
-- 015: AI PENDING ACTIONS — Jantung sistem "Agen Otonom
--      dengan Human-in-the-Loop" (Task 34 — Major Update)
--
-- Alur arsitektur (SOP Bos):
--   1. Agen AI (Sinta/Maya/Farhan/Bagas/Raka/Dewi/Putri) mendeteksi
--      TRIGGER dari DATA RIIL (Supabase / API eksternal / ping situs /
--      counter kuota) — BUKAN karangan LLM.
--   2. Kode Next.js INSERT proposal ke tabel ini dengan status 'pending'.
--   3. CEO (Bos) melihat "Antrean Eksekusi" di Dashboard Alexander
--      → tekan [✅ ACC & Eksekusi] atau [❌ Tolak].
--   4. /api/execute-action mengeksekusi AKSI NYATA (Resend / Meta Graph
--      API / blog / Discord / feature flag) → status jadi 'approved'
--      (+ hasil eksekusi dicatat), atau 'rejected' jika ditolak.
--
-- Jalankan di Supabase Dashboard → SQL Editor (sekali saja).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Karyawan pengusul: 'Sinta', 'Maya', 'Farhan', 'Bagas', 'Raka', 'Dewi', 'Putri'
  agent_name TEXT NOT NULL,
  -- Identifier unik aksi, mis:
  --   PUBLISH_CONTENT | SEND_WINBACK_EMAIL | UPDATE_AB_TEST |
  --   SEND_UPGRADE_OFFER | BROADCAST_MAINTENANCE | TRIGGER_INTERNAL_TASK |
  --   TOGGLE_FREE_FEATURES
  action_type TEXT NOT NULL,
  -- Data RIIL yang akan dieksekusi (email tujuan, draf, pengaturan A/B, dll)
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 'pending' → menunggu keputusan CEO
  -- 'approved' → di-ACC & sudah dieksekusi native
  -- 'rejected' → ditolak CEO
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Audit eksekusi
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  executed_result JSONB
);

-- Antrean CEO: filter status + terbaru dulu
CREATE INDEX IF NOT EXISTS idx_apa_status_created
  ON public.ai_pending_actions (status, created_at DESC);

-- Dedup proposal: 1 agen + 1 jenis aksi dalam window waktu
CREATE INDEX IF NOT EXISTS idx_apa_agent_type_created
  ON public.ai_pending_actions (agent_name, action_type, created_at DESC);

-- ============================================================
-- RLS: tabel HANYA diakses lewat API route server kita
-- (service role menembus RLS). Tidak ada policy INSERT/UPDATE
-- untuk anon/authenticated → proposal hanya bisa dibuat agen
-- server-side, keputusan hanya lewat API CEO.
-- ============================================================
ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRANTS (WAJIB — tanpa ini service_role kena 42501
-- "permission denied for table" karena service_role menembus
-- RLS tapi TIDAK menembus table grants):
-- ============================================================
GRANT ALL ON public.ai_pending_actions TO service_role;
GRANT SELECT ON public.ai_pending_actions TO authenticated;
-- anon: sengaja TIDAK diberi grant (hanya API server yang mengakses)

-- ============================================================
-- BONUS: tabel blog_posts — target eksekusi nyata untuk proposal
-- PUBLISH_CONTENT platform 'blog' (Sinta CMO menulis, CEO ACC,
-- konten masuk database blog situs).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  author TEXT NOT NULL DEFAULT 'Sinta (CMO — AI Agent)',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_created
  ON public.blog_posts (created_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.blog_posts TO service_role;
GRANT SELECT ON public.blog_posts TO authenticated, anon;
