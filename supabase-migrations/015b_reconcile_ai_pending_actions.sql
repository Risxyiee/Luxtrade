-- ============================================================
-- 015b: PENYELARASAN ai_pending_actions (Task 34 — FASE 2)
--
-- Konteks: tabel ai_pending_actions sudah dibuat lewat SQL manual
-- (kolom reason/resolved_at/resolved_by + status ENUM). Kode Task 34
-- (agent-proposals.ts + /api/execute-action) menulis ke kolom
-- executed_at & executed_result saat CEO ACC/Tolak, dan mengeksekusi
-- PUBLISH_CONTENT platform 'blog' ke tabel blog_posts.
-- Tanpa migration ini: PATCH status GAGAL (kolom tidak ada) → row
-- tetap 'pending' → CEO bisa mengeksekusi dobel. BLOG juga gagal 404.
--
-- Yang dilakukan (TANPA menghapus data):
--   1. Tambah kolom executed_at + executed_result (WAJIB)
--   2. status: ENUM → TEXT (persis 015)
--   3. Buat blog_posts + agent_kv bila belum ada
--   4. Tutup celah keamanan: user biasa tidak boleh insert/update
--      antrean langsung (hanya server service_role)
-- Idempotent: aman dijalankan berulang.
-- ============================================================

-- 1) Kolom audit eksekusi (dipakai /api/execute-action → decideAction)
ALTER TABLE public.ai_pending_actions
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE public.ai_pending_actions
  ADD COLUMN IF NOT EXISTS executed_result JSONB;

-- 2) Samakan tipe status jadi TEXT (dari ENUM action_status)
ALTER TABLE public.ai_pending_actions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.ai_pending_actions
  ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.ai_pending_actions
  ALTER COLUMN status SET DEFAULT 'pending';
DROP TYPE IF EXISTS public.action_status;

-- 3) Tabel blog_posts (target eksekusi PUBLISH_CONTENT platform 'blog')
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  author TEXT NOT NULL DEFAULT 'Sinta (CMO — AI Agent)',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created ON public.blog_posts (created_at DESC);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- 4) agent_kv (dipakai detektor + feature flag) — bila belum ada
CREATE TABLE IF NOT EXISTS public.agent_kv (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.agent_kv ENABLE ROW LEVEL SECURITY;

-- 5) Keamanan RLS antrean: user biasa tidak boleh menulis langsung
--    (approve/reject HANYA lewat /api/execute-action — khusus CEO)
DROP POLICY IF EXISTS "auth_insert_pending" ON public.ai_pending_actions;
DROP POLICY IF EXISTS "auth_update_status" ON public.ai_pending_actions;

-- 6) GRANT (pelajaran migration 011 — tanpa GRANT service_role kena 42501)
GRANT ALL ON public.ai_pending_actions TO service_role;
GRANT SELECT ON public.ai_pending_actions TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
GRANT SELECT ON public.blog_posts TO authenticated, anon;
GRANT ALL ON public.agent_kv TO service_role;

-- 7) VERIFIKASI — kolom yang harus muncul: id, agent_name, action_type,
--    action_payload, status (text), reason, created_at, updated_at,
--    resolved_at, resolved_by, executed_at, executed_result
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_pending_actions'
ORDER BY ordinal_position;
