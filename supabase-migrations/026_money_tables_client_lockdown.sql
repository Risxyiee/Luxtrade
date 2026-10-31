-- ============================================================
-- MIGRASI 026 — LOCKDOWN TABEL UANG: AKSES CLIENT DITUTUP TOTAL
-- (v2 — kebal tabel yang tidak ada)
-- ============================================================
-- Audit kode (sampai commit 7d7cfa8a):
--   Tabel-tabel uang di bawah HANYA disentuh route API server + lib
--   service-role (affiliate-commission, missions/claim, midtrans
--   webhook, withdraw, admin routes, signup). Audit menyeluruh
--   menunjukkan TIDAK ADA satu pun komponen browser yang membaca/
--   menulis tabel-tabel ini:
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
-- v2 CATATAN: tabel "activation_keys" ternyata TIDAK ADA di produksi
--   (juga tidak ada di kode — salah asumsi v1) dan membuat REVOKE
--   literal gagal 42P01 di tengah jalan. Versi ini pakai guard
--   to_regclass: tabel yang ada dikunci, yang tidak ada dilewati
--   dengan NOTICE — script tidak pernah error, idempotent.
--
--   service_role TIDAK tersentuh — semua route server tetap jalan.
--   Policies dibiarkan (prinsip: kalau ragu gausah dihapus) — policy
--   tanpa privilege tidak pernah menyala.
--
-- EKSEKUSI: Supabase Dashboard → SQL Editor → Run. (Bos)

DO $$
DECLARE
  t TEXT;
  tabel_uang TEXT[] := ARRAY[
    'affiliates',
    'withdrawals',
    'payment_orders',
    'user_submissions',
    'affiliate_referrals',
    'activation_keys'  -- kemungkinan tidak ada; dilewati otomatis
  ];
BEGIN
  FOREACH t IN ARRAY tabel_uang LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated, anon', t);
      RAISE NOTICE 'LOCKED: public.%', t;
    ELSE
      RAISE NOTICE 'SKIP (tabel tidak ada): public.%', t;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- VERIFIKASI 1 — HARUS HASIL KOSONG (0 baris):
-- ============================================================
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN ('affiliates','withdrawals','payment_orders',
--                      'user_submissions','affiliate_referrals',
--                      'activation_keys')
--   AND grantee IN ('anon','authenticated')
-- ORDER BY table_name, grantee, privilege_type;
--
-- VERIFIKASI 2 (opsional) — lihat tabel mana saja yang ada & dikunci:
--
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('affiliates','withdrawals','payment_orders',
--                      'user_submissions','affiliate_referrals',
--                      'activation_keys')
-- ORDER BY table_name;
