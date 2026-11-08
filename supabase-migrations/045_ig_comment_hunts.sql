-- ============================================================
-- 045: IG COMMENT HUNTS — Jejak "PEMBURU KOMENTAR" (karyawan AI)
-- ------------------------------------------------------------
-- Konteks: karyawan AI baru bertugas memantau KOMENTAR di
-- postingan Instagram milik sendiri (patuh ToS: HANYA komentar
-- pada media milik sendiri, via Graph API resmi — bukan scraping,
-- bukan komentar ke akun orang lain).
--
-- Alur hunt (cron /api/cron/comment-hunter, numpang slot 15 menit
-- dgn throttle internal — hunt beneran maks tiap 2 jam):
--   1. Graph API: daftar media terakhir akun IG kita + komentar
--      di tiap media.
--   2. Komentar BARU (comment_id belum ada di tabel ini) →
--      diklasifikasi niatnya (tanya-cara / minat-harga /
--      tanya-sinyal / sapa-halo / pujian / negatif-spam / lain).
--   3. Yang aman → dibalas otomatis via POST /{comment-id}/replies
--      (kuota ketat: maks 5/run, 15/hari WIB) → status
--      'auto_replied'. Sisanya draf ('drafted') untuk ACC Bos,
--      spam dilewati ('skipped'), gagal kirim ('failed').
--   4. 'minat-harga' ditandai lead_flag=true → dilapor ke Bos via
--      Discord (propek berminat beli).
--
-- Dedupe: comment_id UNIK — komentar yang sama tidak pernah
-- diproses dua kali walau cron jalan berulang / isolate CF ganti.
--
-- Jalankan di Supabase Dashboard → SQL Editor (sekali saja).
-- IDEMPOTENT: aman dijalankan berulang (IF NOT EXISTS di semua
-- objek, GRANT/REVOKE/COMMENT tidak error saat diulang).
-- ============================================================

-- 1) Tabel jejak hunt (no-op kalau sudah ada)
CREATE TABLE IF NOT EXISTS public.ig_comment_hunts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ID media/postingan IG tempat komentar muncul
  media_id text NOT NULL,
  -- Link postingan (biar Bos bisa langsung buka dari laporan)
  permalink text,
  -- ID komentar IG — UNIK, kunci dedupe antar-run
  comment_id text NOT NULL,
  -- Username pengomentar (tanpa @, apa adanya dari Graph API)
  username text,
  -- Isi komentar mentah
  comment_text text,
  -- Hasil klasifikasi niat: tanya-cara | minat-harga | tanya-sinyal
  -- | sapa-halo | pujian | negatif-spam | lain
  intent text NOT NULL DEFAULT 'lain',
  -- Draf balasan (template otomatis / hasil LLM untuk ACC Bos)
  reply_text text,
  -- 'auto_replied' → sudah dibalas otomatis via Graph API
  -- 'drafted'     → draf menunggu ACC Bos (atau kuota balasan habis)
  -- 'skipped'     → sengaja tidak dibalas (negatif-spam/lain polos)
  -- 'failed'      → percobaan balas otomatis gagal (reply_text tetap draf)
  status text NOT NULL DEFAULT 'drafted'
    CHECK (status IN ('auto_replied', 'drafted', 'skipped', 'failed')),
  -- true bila intent 'minat-harga' → propek, masuk laporan Discord
  lead_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz
);

-- 2) Kunci dedupe: satu komentar hanya diproses sekali seumur hidup
CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_comment_hunts_comment
  ON public.ig_comment_hunts (comment_id);

-- 3) Laporan/ringkasan per waktu (terbaru dulu)
CREATE INDEX IF NOT EXISTS idx_ig_comment_hunts_created
  ON public.ig_comment_hunts (created_at DESC);

-- 4) Cari cepat jejak per media (debug/audit per postingan)
CREATE INDEX IF NOT EXISTS idx_ig_comment_hunts_media
  ON public.ig_comment_hunts (media_id, created_at DESC);

-- ============================================================
-- RLS: tabel internal karyawan AI — TIDAK ADA policy publik.
-- Browser/aplikasi klien (anon/authenticated) TIDAK boleh baca
-- isi komentar pengguna (privasi) maupun draf balasan.
-- Semua akses hanya lewat API server (service_role menembus RLS).
-- ============================================================
ALTER TABLE public.ig_comment_hunts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRANTS (pola migrasi 043 — tanpa ini service_role kena 42501
-- "permission denied for table" karena RLS bukan grant).
-- Berbeda dari 043: tabel internal → anon/authenticated TIDAK
-- dapat apa pun (tidak ada GRANT + REVOKE tegas utk berjaga-jaga
-- kalau default privileges project memberi hak bawaan).
-- ============================================================
GRANT ALL PRIVILEGES ON public.ig_comment_hunts TO service_role;
REVOKE ALL ON public.ig_comment_hunts FROM anon, authenticated;

-- ============================================================
-- Dokumentasi skema (muncul di Table Editor / introspeksi)
-- ============================================================
COMMENT ON TABLE public.ig_comment_hunts IS
  'Jejak PEMBURU KOMENTAR: komentar IG di postingan milik sendiri (Graph API resmi) yang diklasifikasi niatnya, dibalas otomatis bila aman (kuota ketat), dan dilaporkan ke Bos bila propek. Dedupe per comment_id — jalankan cron /api/cron/comment-hunter.';

COMMENT ON COLUMN public.ig_comment_hunts.comment_id IS
  'ID komentar IG — unik, kunci dedupe antar-run cron.';

COMMENT ON COLUMN public.ig_comment_hunts.intent IS
  'Niat komentar: tanya-cara | minat-harga (lead) | tanya-sinyal | sapa-halo | pujian | negatif-spam | lain.';

COMMENT ON COLUMN public.ig_comment_hunts.status IS
  'auto_replied = dibalas otomatis; drafted = draf nunggu ACC Bos; skipped = sengaja tak dibalas (spam/lain); failed = kirim balasan gagal.';

COMMENT ON COLUMN public.ig_comment_hunts.lead_flag IS
  'true = propek (minat beli) → masuk laporan Discord Bos.';

COMMENT ON COLUMN public.ig_comment_hunts.replied_at IS
  'Waktu balasan otomatis berhasil dikirim (null bila belum/bukan auto_replied).';
