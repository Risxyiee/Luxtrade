-- ============================================================
-- MIGRASI 023 — P3 FINAL: WITHDRAW AFFILIATE 100% ATOMIK (RPC)
-- ============================================================
-- Konteks (audit E2E, TEMUAN #5 / P3):
--   FIX #1 (P0) sudah menutup kasus utama: CAS PostgREST
--   (UPDATE ... WHERE current_balance >= amount) + anti-stack
--   REQUESTED + refund. Sisa lubang halus: nilai potong dihitung
--   aplikasi dari saldo yang dibaca SEBELUM CAS — dua request
--   paralel bisa timpa pakai saldo basi (lost update, potongan
--   kurang dari seharusnya, saldo tidak pernah negatif tapi
--   tidak akurat).
--
-- Solusi: Postgres FUNCTION (SECURITY DEFINER) yang mengerjakan
-- SELURUH pengajuan withdraw dalam SATU transaksi dgn row lock:
--   1. SELECT ... FOR UPDATE affiliates  (serialisasi race)
--   2. Cek maks 1 pengajuan REQUESTED
--   3. Cek minimum & saldo
--   4. UPDATE saldo + INSERT withdrawal (atomik — kalau insert
--      gagal, SELURUH transaksi rollback = saldo otomatis utuh)
--
-- Route /api/affiliate/withdraw memanggil RPC ini DULU; bila
-- fungsi belum ada (migrasi belum jalan) → fallback CAS lama.
-- Idempotent: CREATE OR REPLACE.
--
-- EKSEKUSI: Supabase Dashboard → SQL Editor → Run. (Bos)

CREATE OR REPLACE FUNCTION request_affiliate_withdrawal(
  p_affiliate_id TEXT,
  p_amount DOUBLE PRECISION,
  p_bank_account_info TEXT,
  p_min_withdrawal DOUBLE PRECISION DEFAULT 100000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance          DOUBLE PRECISION;
  v_new_balance      DOUBLE PRECISION;
  v_withdrawal_id    TEXT;
  v_requested_at     TIMESTAMPTZ;
  v_pending          INT;
BEGIN
  -- ── 1. Kunci baris affiliate (request paralel antre di sini) ──
  SELECT current_balance INTO v_balance
  FROM affiliates
  WHERE id = p_affiliate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'affiliate_not_found');
  END IF;

  -- ── 2. Anti-stack: maks 1 pengajuan REQUESTED per affiliate ──
  SELECT count(*) INTO v_pending
  FROM affiliate_withdrawals
  WHERE affiliate_id = p_affiliate_id
    AND status = 'REQUESTED';

  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'pending_exists');
  END IF;

  -- ── 3. Validasi minimum & saldo (nilai PASTI segar) ──
  IF p_amount < p_min_withdrawal THEN
    RETURN jsonb_build_object('ok', false, 'code', 'below_minimum',
      'minimum', p_min_withdrawal);
  END IF;

  IF p_amount > v_balance THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_balance',
      'balance', v_balance);
  END IF;

  -- ── 4. Potong saldo + catat withdrawal (SATU transaksi) ──
  v_new_balance := v_balance - p_amount;

  UPDATE affiliates
  SET current_balance = v_new_balance
  WHERE id = p_affiliate_id;

  -- id dibangkitkan eksplisit (aman utk kolom TEXT dgn/tanpa default —
  -- cuid lama Prisma tidak selalu punya DEFAULT di DB).
  v_withdrawal_id := 'wd_' || encode(gen_random_bytes(12), 'hex');

  BEGIN
    INSERT INTO affiliate_withdrawals
      (id, affiliate_id, amount, bank_account_info, status, requested_at)
    VALUES
      (v_withdrawal_id, p_affiliate_id, p_amount, p_bank_account_info,
       'REQUESTED', now())
    RETURNING requested_at INTO v_requested_at;
  EXCEPTION
    -- Tabel ternyata tidak punya kolom requested_at (skema lama) —
    -- insert tanpa kolom waktu; kalau id juga bermasalah → error naik
    -- dan SELURUH transaksi rollback (saldo tidak terpotong).
    WHEN undefined_column THEN
      INSERT INTO affiliate_withdrawals
        (id, affiliate_id, amount, bank_account_info, status)
      VALUES
        (v_withdrawal_id, p_affiliate_id, p_amount, p_bank_account_info,
         'REQUESTED');
      v_requested_at := now();
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_withdrawal_id,
    'amount', p_amount,
    'balance', v_new_balance,
    'requested_at', v_requested_at
  );
END;
$$;

-- ── Hak akses: HANYA service-role (dipakai route server) ──
-- Default Postgres memberi EXECUTE ke PUBLIC → dicabut supaya
-- client anon/authenticated tidak bisa memanggil langsung.
REVOKE ALL ON FUNCTION request_affiliate_withdrawal(TEXT, DOUBLE PRECISION, TEXT, DOUBLE PRECISION) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_affiliate_withdrawal(TEXT, DOUBLE PRECISION, TEXT, DOUBLE PRECISION) FROM anon;
REVOKE ALL ON FUNCTION request_affiliate_withdrawal(TEXT, DOUBLE PRECISION, TEXT, DOUBLE PRECISION) FROM authenticated;
GRANT EXECUTE ON FUNCTION request_affiliate_withdrawal(TEXT, DOUBLE PRECISION, TEXT, DOUBLE PRECISION) TO service_role;

-- ── Verifikasi (jalankan setelah CREATE) ──
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'request_affiliate_withdrawal';
-- (harus 1 baris, prosecdef = true)
