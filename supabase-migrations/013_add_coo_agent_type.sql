-- ============================================================
-- 013: Tambah karyawan AI COO (Chief Operating Officer — Jualan)
-- Karyawan lama (CS & MARKETING) dipensiunkan — digantikan 1 COO
-- yang fokus monetisasi: konversi free user aktif → PRO.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Cepat & aman.
-- ============================================================

-- Lebarkan constraint agent_type supaya menerima 'COO'
ALTER TABLE public.ai_pending_tasks
  DROP CONSTRAINT IF EXISTS ai_pending_tasks_agent_type_check;

ALTER TABLE public.ai_pending_tasks
  ADD CONSTRAINT ai_pending_tasks_agent_type_check
  CHECK (agent_type IN ('CS', 'MARKETING', 'COO'));
