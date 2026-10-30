-- ============================================================
-- 017: FIX RLS E2E + DEFAULT trades.updated_at
-- ============================================================
-- Akar masalah dari E2E AUTO-TEST 6/9 (diagnosa reproduksi asli):
--
--   ❌ Profile read 403 → 42501 "permission denied for table users"
--      = ada policy RLS (dibuat via dashboard, di luar repo) yang membaca
--        auth.users langsung. Supabase sudah MENGUNCI akses auth.users untuk
--        role anon/authenticated → policy begini SELALU error untuk setiap
--        query authenticated. App tetap jalan karena API route pakai
--        service_role (bypass RLS) — tapi E2E + fitur client-side kena.
--      Fix: DROP policy yang membaca auth.users (dijamin rusak — menghapusnya
--      hanya MEMULIHKAN akses dari policy lain yang sehat, tidak membuka akses).
--
--   ❌ Trade insert 400 → 23502 "null value in column updated_at"
--      = trades.updated_at NOT NULL tanpa default. Prisma mengisi via client
--      (@updatedAt) tapi insert REST polos (E2E, agen AI) tidak mengisi.
--      Fix: SET DEFAULT now().
--
--   ❌ Trade select gagal → efek berantai dari insert gagal (otomatis beres).
--
-- Aman dijalankan berkali-kali (idempotent). Semua aksi tercetak di NOTICE.
-- Jalankan: Supabase Dashboard → SQL Editor → Run.
-- ============================================================

/* ── PART 1: trades.updated_at default (fix insert REST 400) ── */
ALTER TABLE public.trades ALTER COLUMN updated_at SET DEFAULT now();

/* ── PART 2: GRANT dasar authenticated (idempotent — kalau sempat terevoke) ── */
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;

/* ── PART 3: bersihkan policy RLS yang RUSAK (membaca auth.users) ──
   Policy yang menyentuh auth.users dijamin error 42501 untuk role
   authenticated/anon (Supabase mengunci schema auth) → keberadaannya hanya
   membuat SEMUA query meledak 403. DROP = akses kembali ke policy sehat lain.
   Policy yang menyentuh public.users TIDAK disentuh (bisa jadi masih valid —
   hanya dilaporkan lewat NOTICE untuk dicek manual). */
DO $$
DECLARE
  pol RECORD;
  dropped INT := 0;
  manual INT := 0;
  expr TEXT;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ILIKE '%users%'
  LOOP
    expr := coalesce(pol.qual,'') || ' ' || coalesce(pol.with_check,'');
    IF expr ILIKE '%auth.users%' OR expr ILIKE '%auth%users%' THEN
      EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
      RAISE NOTICE '🗑️  DROP (rusak — membaca auth.users yang dikunci Supabase): %.% (%) → %',
        pol.tablename, pol.policyname, pol.cmd, left(expr, 120);
      dropped := dropped + 1;
    ELSE
      RAISE NOTICE '👀 CEK MANUAL (pakai public.users — jangan dihapus tanpa dicek): %.% (%) → %',
        pol.tablename, pol.policyname, pol.cmd, left(expr, 120);
      manual := manual + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Selesai: % policy rusak di-drop, % perlu dicek manual', dropped, manual;
END $$;

/* ── PART 4: pastikan policy dasar profiles ada & sehat (idempotent) ──
   PENTING: profiles.id bertipe TEXT (bawaan Prisma) → WAJIB cast
   auth.uid()::text (pola sama dgn 20261001_fix_rls_text_user_id_cast.sql).
   Tanpa cast: error 42883 "operator does not exist: uuid = text". */
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- ═══════════════════════════════════════════════════════════
-- VERIFIKASI (grid hasil di bawah):
--   1. default updated_at  → harus column_default tidak NULL
--   2. sisa policy profiles → tidak boleh ada yang menyebut users
-- ═══════════════════════════════════════════════════════════
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'trades' AND column_name = 'updated_at';

SELECT tablename, policyname, cmd,
       left(coalesce(qual,'') || ' ' || coalesce(with_check,''), 90) AS ekspresi
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('profiles','trades')
ORDER BY tablename, policyname;
