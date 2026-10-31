-- ============================================================
-- 035 — CSP VIOLATIONS TABLE: penyimpanan laporan CSP (FASE 4)
-- ============================================================
-- Konteks: CSP Report-Only terpasang di next.config.ts sejak audit #7.
-- Laporan pelanggaran browser dikirim ke POST /api/security/csp-report
-- yang dulu hanya console.warn (nyangkut di CF Observability — susah
-- dibaca, hilang setelah retention log).
--
-- Sekarang: laporan DISIMPAN ke tabel ini sehingga Bos bisa melihat
-- PAPAN LAPORAN CSP di /dashboard/admin/csp — bahan keputusan kapan
-- CSP boleh dinaikkan dari report-only → ENFORCE tanpa merusak fitur.
--
-- KEAMANAN:
--   • RLS ENABLED + TANPA policy publik → hanya service_role yang bisa
--     baca/tulis (pola sama dengan email_broadcasts / ai_pending_actions).
--   • Endpoint csp-report insert pakai SERVICE KEY (server-only).
--   • Endpoint papan (GET/DELETE) pakai requireAdmin (Bearer admin).
--
-- RETENSI: endpoint insert kadang-kadang (±2% request) menghapus baris
-- lebih tua dari 30 hari — tanpa perlu pg_cron. Bisa juga dibersihkan
-- manual dari tombol "Bersihkan" di papan.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + DO-block guard. Aman diulang.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.csp_violations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_uri        text,
  violated_directive  text,          -- direktif yang dilanggar (legacy name)
  effective_directive text,          -- direktif efektif (modern name)
  blocked_uri         text,
  source_file         text,
  line_number         integer,
  column_number       integer,
  disposition         text,          -- 'report' saat report-only
  status_code         integer,
  script_sample       text,          -- potongan kode pelanggar (cap 500 char)
  referrer            text,
  user_agent          text,
  raw                 jsonb,         -- laporan utuh utk audit mendalam
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Index papan: agregasi per directive+blocked+document & filter waktu
CREATE INDEX IF NOT EXISTS csp_violations_group_idx
  ON public.csp_violations (effective_directive, blocked_uri, document_uri);
CREATE INDEX IF NOT EXISTS csp_violations_created_idx
  ON public.csp_violations (created_at DESC);

-- RLS: terkunci total — TIDAK ADA policy publik (service_role bypass RLS)
ALTER TABLE public.csp_violations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.csp_violations') IS NOT NULL THEN
    RAISE NOTICE '✅ tabel csp_violations siap (RLS terkunci, index terpasang)';
  ELSE
    RAISE NOTICE '❌ tabel tidak ditemukan — cek error di atas';
  END IF;
END
$$;
