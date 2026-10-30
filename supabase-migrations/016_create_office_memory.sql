-- ============================================================
-- 016: OFFICE MEMORY — Memori jangka panjang "AI Workforce"
-- ============================================================
-- Master Cron otonom (8 agen) menulis & membaca tabel ini agar
-- agen BELAJAR dari hari sebelumnya:
--   • hasil kritik Actor-Critic (skor + feedback critic)
--   • pelajaran ("lesson") yang diinjeksi ke prompt esok hari
--   • laporan keamanan Raka & briefing Alexander sebagai arsip
--
-- Tanpa tabel ini master cron TETAP JALAN (degrade gracefully,
-- tanpa pembelajaran lintas hari) — sama seperti pola cron lain.
--
-- Jalankan di Supabase Dashboard → SQL Editor (sekali saja).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.office_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nama karyawan: 'Farhan','Sinta','Raka','Maya','Bagas','Putri','Dewi','Alexander'
  agent_name TEXT NOT NULL,
  -- Tanggal (WIB) saat memori dibuat — untuk kueri "belajar dari kemarin"
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 'critic'   = hasil penilaian Actor-Critic (skor + feedback)
  -- 'lesson'   = pelajaran ringkas untuk prompt esok hari
  -- 'security' = temuan security sweep Raka
  -- 'report'   = briefing harian Alexander
  memory_type TEXT NOT NULL DEFAULT 'lesson',
  -- Isi bebas (JSON): { lesson, score, model, keyword, ... }
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recall cepat: memori terbaru per agen
CREATE INDEX IF NOT EXISTS idx_office_memory_agent_created
  ON public.office_memory (agent_name, created_at DESC);

-- RLS: hanya diakses lewat API route server (service_role menembus RLS).
ALTER TABLE public.office_memory ENABLE ROW LEVEL SECURITY;

-- GRANTS wajib (tanpa ini service_role kena 42501 "permission denied")
GRANT ALL ON public.office_memory TO service_role;
GRANT SELECT ON public.office_memory TO authenticated;
-- anon: sengaja TIDAK diberi grant.
