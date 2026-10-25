-- ============================================================
-- 011: AI Staff Automation (Human-in-the-Loop)
-- Tabel antrean draf yang dibuat agen AI (CS & Marketing).
-- AI menulis draf → status 'pending' → admin approve/reject
-- lewat Dashboard Admin (/admin/ai-staff).
--
-- Jalankan di Supabase Dashboard → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_pending_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'CS' = karyawan customer success (email follow-up)
  -- 'MARKETING' = karyawan content marketer (ide konten TikTok)
  agent_type TEXT NOT NULL CHECK (agent_type IN ('CS', 'MARKETING')),
  -- User yang jadi target aksi (NULL untuk task marketing global)
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Data pendukung: profil user (email, nama, total trades) atau
  -- snapshot performa audiens TikTok yang dipakai AI
  context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Hasil draft AI:
  --   CS       → { "subject": "...", "body": "...", "provider": "groq" }
  --   MARKETING→ { "analysis": "...", "ideas": [{ "hook", "script", "caption", "cta" }] }
  generated_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 'pending' → menunggu approval admin
  -- 'approved' → sudah di-approve & dieksekusi (email terkirim / konten selesai)
  -- 'rejected' → ditolak admin
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Audit eksekusi (kapan di-approve/reject + hasil pengiriman)
  executed_at TIMESTAMPTZ,
  executed_result JSONB
);

-- Query antrean admin: filter status + agent_type
CREATE INDEX IF NOT EXISTS idx_ai_pending_tasks_status
  ON public.ai_pending_tasks (status, agent_type, created_at DESC);

-- Dedup harian per user (CS agent: "belum dikontak hari ini")
CREATE INDEX IF NOT EXISTS idx_ai_pending_tasks_target_created
  ON public.ai_pending_tasks (target_user_id, created_at DESC);

-- ============================================================
-- RLS: tabel ini HANYA diakses lewat API route server kita
-- (service role bypass RLS). Tidak ada policy publik →
-- anon key TIDAK bisa baca antrean draf email user.
-- ============================================================
ALTER TABLE public.ai_pending_tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRANTS (WAJIB — tanpa ini service_role kena 42501
-- "permission denied for table" karena service_role menembus
-- RLS tapi TIDAK menembus table grants):
-- ============================================================
GRANT ALL ON public.ai_pending_tasks TO service_role;
GRANT SELECT ON public.ai_pending_tasks TO authenticated;
-- anon: sengaja TIDAK diberi grant (hanya API server yang mengakses)
