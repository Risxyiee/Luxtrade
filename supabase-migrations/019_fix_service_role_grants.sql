-- ═══════════════════════════════════════════════════════════════
-- 019 — FIX GRANT service_role (akar 500 form kontak)
-- Bukti: log CF produksi
--   [contact] insert failed: 42501 permission denied for table contact_messages
-- Key service_role VALID (detektor role="anon" lolos tanpa alarm), tapi
-- tabel contact_messages tidak punya GRANT utk service_role — kemungkinan
-- default privileges project tidak standar saat tabel dibuat via SQL Editor.
-- RLS tetap deny-all utk anon/authenticated (desain keamanan tidak diubah).
--
-- Jalankan di Supabase SQL Editor (Bos), lalu Z tes ulang form kontak.
-- Verifikasi:
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name='contact_messages' AND grantee='service_role';
-- ═══════════════════════════════════════════════════════════════

-- 1) Fix langsung: contact_messages bisa ditulis/dibaca backend (service role)
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.contact_messages TO service_role;

-- 2) Cegah kekambuhan: SEMUA tabel existing dapat akses backend kembali
--    (ini state bawaan Supabase — service_role adalah role backend internal,
--    bukan role publik; anon/authenticated TIDAK disentuh)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3) Tabel/baris baru yang dibuat Bos ke depan otomatis dapat akses backend
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
