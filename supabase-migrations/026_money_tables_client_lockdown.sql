-- ============================================================
-- MIGRASI 026 — LOCKDOWN TABEL UANG: AKSES CLIENT DITUTUP TOTAL
-- ============================================================
-- Audit kode (sampai commit 7d7cfa8a):
--   6 tabel di bawah HANYA disentuh route API server + lib service-role
--   (affiliates-commission, missions/claim, midtrans webhook, withdraw,
--   admin routes, signup). Audit menyeluruh menunjukkan TIDAK ADA satu
--   pun komponen browser yang membaca/menulis tabel-tabel ini:
--   - .from('<tabel>') literal  → hanya di src/app/api/** + lib server
--   - .from( dinamis            → hanya Array.from/Buffer.from
--   - fetch rest/v1 langsung    → hanya di route API, bukan tabel uang
--   - realtime postgres_changes → nol di seluruh kode
--
--   Karena itu authenticated & anon TIDAK PERLU privilege apa pun ke
--   tabel-tabel ini. User login yang nakal tidak boleh bisa menyentuh
--   baris uang langsung via PostgREST — meskipun policy RLS membatasi
--   ke "baris sendiri", UPDATE saldo affiliates sendiri tetap berbahaya.
--
--   service_role TIDAK tersentuh — semua route server tetap jalan.
--   Policies dibiarkan (prinsip: kalau ragu gausah dihapus) — policy
--   tanpa privilege tidak pernah menyala.
--
-- EKSEKUSI: Supabase Dashboard → SQL Editor → Run. (Bos)
-- Idempotent: REVOKE ulang = sama-aman.

REVOKE ALL ON TABLE public.affiliates          FROM authenticated, anon;
REVOKE ALL ON TABLE public.withdrawals         FROM authenticated, anon;
REVOKE ALL ON TABLE public.payment_orders      FROM authenticated, anon;
REVOKE ALL ON TABLE public.activation_keys     FROM authenticated, anon;
REVOKE ALL ON TABLE public.user_submissions    FROM authenticated, anon;
REVOKE ALL ON TABLE public.affiliate_referrals FROM authenticated, anon;

-- ============================================================
-- VERIFIKASI — HARUS HASIL KOSONG (0 baris):
-- ============================================================
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN ('affiliates','withdrawals','payment_orders',
--                      'activation_keys','user_submissions','affiliate_referrals')
--   AND grantee IN ('anon','authenticated')
-- ORDER BY table_name, grantee, privilege_type;
