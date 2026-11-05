-- ============================================================
-- PINE_ALERT_PINE_SCRIPTS.sql — Alert otomatis untuk Pine milik user
-- ============================================================
-- Jalankan di Supabase SQL Editor (sekali saja).
--
-- Latar (permintaan Bos 2026-11-05):
--   Pine default "Luxtradee Candle Impulsif" DIHAPUS dari UI — tiap
--   user pakai Pine buatannya sendiri (tabel pine_scripts) dan bisa
--   pasang alert otomatis (🔔) pada Pine miliknya.
--
-- Masalah: pine_alert_subscriptions.script_id & pine_alert_log.script_id
--   punya FOREIGN KEY ke protected_scripts(id) — UUID dari pine_scripts
--   ditolak. Kolom script_kind ditambahkan untuk membedakan jenis skrip
--   ('protected' = eksklusif, 'pine' = milik user).
--
-- Aman dijalankan berkali-kali (idempotent).

-- 1) Lepas FK script_id → protected_scripts (dua tabel)
ALTER TABLE public.pine_alert_subscriptions
  DROP CONSTRAINT IF EXISTS pine_alert_subscriptions_script_id_fkey;
ALTER TABLE public.pine_alert_log
  DROP CONSTRAINT IF EXISTS pine_alert_log_script_id_fkey;

-- 2) Kolom jenis skrip (default 'protected' untuk baris lama)
ALTER TABLE public.pine_alert_subscriptions
  ADD COLUMN IF NOT EXISTS script_kind text NOT NULL DEFAULT 'protected';

ALTER TABLE public.pine_alert_subscriptions
  DROP CONSTRAINT IF EXISTS pine_alert_subscriptions_script_kind_check;
ALTER TABLE public.pine_alert_subscriptions
  ADD CONSTRAINT pine_alert_subscriptions_script_kind_check
  CHECK (script_kind IN ('protected', 'pine'));

-- 3) Index dedupe lama tetap berlaku (user_id, script_id, symbol,
--    timeframe) — UUID pine_scripts dan protected_scripts berada di
--    ruang UUID yang sama, tidak akan bertabrakan.

-- Selesai. Tidak ada data lama yang berubah — langganan lama tetap
-- 'protected'. Langganan baru pada Pine milik user = script_kind 'pine'.
