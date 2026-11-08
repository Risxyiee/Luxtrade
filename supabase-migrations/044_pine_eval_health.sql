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
