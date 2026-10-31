-- ══════════════════════════════════════════════════════════════════════════
-- MIGRATION 021 — Penutup Audit E2E (Fitur A: Missions Claim,
--                  Fitur B: Affiliate Withdraw) + Hardening RLS
-- Tanggal: 2026-02-09
--
-- LATAR (audit E2E — temuan terverifikasi probe produksi):
--   1. POST /api/missions/claim = check-then-insert TANPA unique constraint
--      → dua POST paralel = 2 baris APPROVED = reward PRO dobel.
--   2. Policy "Users can update own affiliate" (migrasi 20260728 L341)
--      → user login bisa PATCH current_balance sendiri via PostgREST
--        dengan JWT-nya → ajukan withdraw → uang nyata. SEMUA tulisan
--        legit ke tabel ini lewat service-role (route API), jadi policy
--        user-level tidak dipakai siapa pun kecuali penyerang.
--   3. Policy "Users can insert own submissions" hanya cek user_id
--      → user bisa self-INSERT status 'APPROVED' (palsu tampilan klaim;
--      reward tetap lewat server, tapi tutup saja).
--   CATATAN: hardening kolom `profiles` (subscription_until/plan/role)
--   SENGAJA TIDAK masuk di sini — client (src/lib/auth-context.tsx) masih
--   menulis is_pro/subscription_status langsung (auto-lock PRO expired).
--   Kerjakan terpisah setelah alur itu dipindah ke route server.
--
-- IDEMPOTENT: aman dijalankan berulang.
-- Jalankan di Supabase SQL Editor (pola sama dgn migrasi 020).
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- BAGIAN 1 — ANTI DOBEL-KLAIM MISSIONS (race)
-- ──────────────────────────────────────────────────────────────────────────

-- 1a. LAPORAN duplikat (hanya SELECT — lihat dulu apa yang akan dibersihkan)
SELECT user_id, achievement_key, COUNT(*) AS jumlah_duplikat,
       MIN(created_at) AS klaim_pertama
FROM public.user_submissions
WHERE status = 'APPROVED'
GROUP BY user_id, achievement_key
HAVING COUNT(*) > 1
ORDER BY jumlah_duplikat DESC;

-- 1b. BERSIHKAN duplikat APPROVED — klaim PALING AWAL yang disimpan
--     (duplikat = artefak bug race / eksploitasi; klaim pertama = sah)
WITH dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, achievement_key
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.user_submissions
  WHERE status = 'APPROVED'
)
DELETE FROM public.user_submissions
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

-- 1c. Unique index PARSIAL: maksimal 1 klaim APPROVED per (user, misi).
--     PENDING boleh banyak (kirim ulang bukti misi manual tetap bisa).
--     Route /api/missions/claim sudah diperbarui: 23505 → "already claimed"
--     (bukan 500) → race tertutup dari dua sisi.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_submissions_approved
  ON public.user_submissions (user_id, achievement_key)
  WHERE status = 'APPROVED';

-- ──────────────────────────────────────────────────────────────────────────
-- BAGIAN 2 — RLS user_submissions: user tidak boleh self-approve
-- ──────────────────────────────────────────────────────────────────────────
-- Insert/Update legit SELALU lewat service-role (/api/missions/claim &
-- achievement-checker pakai admin client → bypass RLS, tidak terpengaruh).

DROP POLICY IF EXISTS "Users can insert own submissions" ON public.user_submissions;
CREATE POLICY "Users can insert own submissions"
  ON public.user_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text AND status = 'PENDING');

DROP POLICY IF EXISTS "Users can update own submissions" ON public.user_submissions;
CREATE POLICY "Users can update own submissions"
  ON public.user_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text AND status = 'PENDING');

-- ──────────────────────────────────────────────────────────────────────────
-- BAGIAN 3 — RLS affiliates: tutup lubang saldo self-service (UANG)
-- ──────────────────────────────────────────────────────────────────────────
-- Dulu: user login bisa PATCH current_balance/total_earned sendiri via
-- PostgREST. Semua tulisan legit lewat service-role → policy ini drop saja.
-- SELECT sendiri tetap boleh (policy "Users can view own affiliate" utuh).

DROP POLICY IF EXISTS "Users can update own affiliate" ON public.affiliates;

REVOKE UPDATE ON TABLE public.affiliates FROM authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- VERIFIKASI (jalankan & periksa hasil):
--   1. Index ada        → baris ux_user_submissions_approved harus muncul
--   2. Policy affiliates→ tidak boleh ada lagi policy UPDATE utk authenticated
--   3. Policy submissions→ WITH CHECK harus menyebut status = 'PENDING'
-- ══════════════════════════════════════════════════════════════════════════

SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'user_submissions'
  AND indexname = 'ux_user_submissions_approved';

SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('affiliates', 'user_submissions')
ORDER BY tablename, policyname;
