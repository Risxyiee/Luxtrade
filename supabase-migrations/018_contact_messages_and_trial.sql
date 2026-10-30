-- ═══════════════════════════════════════════════════════════════
-- 018 — P1 FIXES: contact_messages + trial server-side
-- Jalankan di Supabase SQL Editor (Bos), lalu verifikasi:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='contact_messages';
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='profiles' AND column_name='trial_started_at';
-- ═══════════════════════════════════════════════════════════════

-- ── 1) Tabel pesan kontak (form /contact — dulu cuma mailto:) ──
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new',       -- new | read | replied
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created
  ON contact_messages (created_at DESC);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Sengaja TANPA policy: RLS aktif + tanpa policy = anon/auth key ditolak.
-- Data hanya bisa dibaca/tulis lewat API server (service role) —
-- form publik menulis via /api/contact yang punya rate limit & validasi.

-- ── 2) Trial PRO server-side (dulu localStorage — bisa dibypass) ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
