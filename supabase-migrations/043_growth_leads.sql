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
