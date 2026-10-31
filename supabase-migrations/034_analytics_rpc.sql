-- ============================================================
-- 034 — ANALYTICS RPC: agregasi pindah ke Postgres (FASE 3)
-- ============================================================
-- Masalah: GET /api/analytics (user PRO) menarik SEMUA baris trades
-- (profit_loss, close_time, session, symbol, dst.) lalu meng-agregasi
-- di JavaScript di CF Workers:
--   - ribuan baris dikirim lewat kabel per request (CPU + bandwidth)
--   - equity curve / drawdown / sharpe / 8 macam GROUP BY dihitung di
--     runtime JS (memo + GC pressure per isolate)
--
-- Solusi: SATU SQL function `get_analytics_snapshot(p_period,
-- p_account_id)` yang menghitung SEMUA metrik di dalam Postgres:
--   - window function utk equity curve + max drawdown
--   - STDDEV_POP utk sharpe ratio (setara populasi-variance JS)
--   - FILTER (WHERE ...) utk win/loss breakdown per dimensi
--   - gaps-and-islands sederhana utk active streak
-- Hasil: 1 round-trip, payload balik = JSON jadi (beberapa KB),
-- tidak lagi N ribuan baris mentah.
--
-- KEAMANAN: SECURITY INVOKER — jalan sebagai role pemanggil, jadi RLS
-- tetap berlaku; identitas user diambil dari auth.uid() (JWT), BUKAN
-- dari parameter → tidak bisa dipalsukan.
--
-- KOMPATIBEL: route /api/analytics mencoba RPC dulu; bila function
-- belum ada (SQL ini belum dijalankan) otomatis fallback ke jalur JS
-- lama. Jadi aman deploy kode dulu, SQL belakangan.
--
-- IDEMPOTENT: CREATE OR REPLACE — aman dijalankan berkali-kali.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_analytics_snapshot(
  p_period text DEFAULT 'all',
  p_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH params AS (
  -- Setara filter tanggal JS (server Workers berjalan UTC):
  --   week  : now() - 7*24h          (JS: Date.now() - 7d, bukan tengah malam)
  --   month : tengah malam UTC, 1 bulan mundur (JS: new Date(y, m-1, d) → tengah malam)
  --   year  : tengah malam UTC, 1 tahun mundur
  SELECT
    CASE p_period
      WHEN 'week'  THEN now() - interval '7 days'
      WHEN 'month' THEN date_trunc('day', now()) - interval '1 month'
      WHEN 'year'  THEN date_trunc('day', now()) - interval '1 year'
      ELSE NULL
    END AS date_filter
),
acc AS (
  -- Saldo awal: akun terpilih (atau akun default) — urutan sama dgn JS
  -- (is_default DESC, created_at ASC, LIMIT 1, wajib is_active & saldo > 0)
  SELECT ta.initial_balance
  FROM public.trading_accounts ta
  WHERE ta.user_id = auth.uid()
    AND ta.is_active = true
    AND (p_account_id IS NULL OR ta.id = p_account_id)
  ORDER BY ta.is_default DESC, ta.created_at ASC
  LIMIT 1
),
acc2 AS (
  -- Fallback rantai JS: trading_accounts.initial_balance (>0) →
  -- prop_firm_challenges.account_size (terbaru aktif) → 0
  SELECT COALESCE(
    NULLIF((SELECT initial_balance FROM acc), 0),
    (SELECT pf.account_size FROM public.prop_firm_challenges pf
      WHERE pf.user_id = auth.uid() AND pf.is_active = true
      ORDER BY pf.created_at DESC
      LIMIT 1),
    0
  ) AS start_balance
),
t AS (
  -- Set trade terfilter (sumber semua agregasi di bawah)
  SELECT tr.*
  FROM public.trades tr CROSS JOIN params p
  WHERE tr.user_id = auth.uid()
    AND (p.date_filter IS NULL OR tr.close_time >= p.date_filter)
    AND (p_account_id IS NULL OR tr.account_id = p_account_id)
),
stats AS (
  SELECT
    COUNT(*)::int                                                        AS total_trades,
    COUNT(*) FILTER (WHERE profit_loss > 0)::int                          AS winning_trades,
    COUNT(*) FILTER (WHERE profit_loss < 0)::int                          AS losing_trades,
    COALESCE(SUM(profit_loss), 0)::float8                                 AS total_pl,
    COALESCE(AVG(profit_loss) FILTER (WHERE profit_loss > 0), 0)::float8  AS avg_profit,
    COALESCE(AVG(profit_loss) FILTER (WHERE profit_loss < 0), 0)::float8  AS avg_loss,
    COALESCE(SUM(profit_loss) FILTER (WHERE profit_loss > 0), 0)::float8  AS gross_profit,
    COALESCE(ABS(SUM(profit_loss) FILTER (WHERE profit_loss < 0)), 0)::float8 AS gross_loss,
    COALESCE(AVG(profit_loss), 0)::float8                                 AS avg_return,
    COALESCE(STDDEV_POP(profit_loss), 0)::float8                          AS sd,
    COALESCE(AVG(trade_duration) FILTER (WHERE trade_duration IS NOT NULL), 0)::float8 AS avg_duration,
    COALESCE(AVG(risk_reward_ratio) FILTER (WHERE risk_reward_ratio IS NOT NULL), 0)::float8 AS avg_rr,
    (SELECT start_balance FROM acc2)                                      AS start_balance
  FROM t
),
eq AS (
  -- Equity curve kumulatif (urutan close_time, id sbg tiebreaker —
  -- lebih deterministik dari JS yang dulu bergantung urutan arbitrer)
  SELECT
    ROW_NUMBER() OVER (ORDER BY close_time, id)                             AS ord,
    to_char((close_time AT TIME ZONE 'UTC'), 'YYYY-MM-DD')                  AS d,
    (SELECT start_balance FROM stats) + SUM(profit_loss) OVER (ORDER BY close_time, id) AS cum
  FROM t
),
dd AS (
  -- Max drawdown = max(peak - cum), peak = max(0, running max cum)
  -- (GREATEST(0,..) mereplikasi inisialisasi peak = 0 di JS)
  SELECT COALESCE(MAX(GREATEST(0, peak) - cum), 0)::float8 AS max_drawdown
  FROM (
    SELECT MAX(cum) OVER (ORDER BY ord) AS peak, cum
    FROM eq
  ) x
),
equity AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('date', d, 'equity', ROUND(cum::numeric, 2))
      ORDER BY ord
    ), '[]'::jsonb) AS curve
  FROM eq
),
sess AS (
  SELECT COALESCE(NULLIF(session, ''), 'Unknown') AS session,
         COUNT(*)::int AS trades,
         SUM(profit_loss)::float8 AS pl,
         COUNT(*) FILTER (WHERE profit_loss > 0)::int AS wins,
         MIN(close_time) AS first_seen   -- urutan first-appearance = Map JS
  FROM t GROUP BY 1
),
monthly AS (
  SELECT to_char((close_time AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
         SUM(profit_loss)::float8 AS pl,
         COUNT(*)::int AS trades
  FROM t GROUP BY 1
),
sym AS (
  SELECT symbol,
         COUNT(*)::int AS trades,
         SUM(profit_loss)::float8 AS pl,
         COUNT(*) FILTER (WHERE profit_loss > 0)::int AS wins
  FROM t GROUP BY 1
),
dow AS (
  SELECT EXTRACT(DOW FROM close_time AT TIME ZONE 'UTC')::int AS dow,
         COUNT(*)::int AS trades,
         SUM(profit_loss)::float8 AS pl,
         COUNT(*) FILTER (WHERE profit_loss > 0)::int AS wins
  FROM t GROUP BY 1
),
setup AS (
  SELECT COALESCE(NULLIF(setup_type, ''), 'Unknown') AS setup_type,
         COUNT(*)::int AS trades,
         SUM(profit_loss)::float8 AS pl,
         COUNT(*) FILTER (WHERE profit_loss > 0)::int AS wins
  FROM t GROUP BY 1
),
today AS (
  -- "Hari ini" = tengah malam UTC (setara setHours(0,0,0,0) di Workers UTC)
  SELECT COUNT(*)::int AS trades,
         COALESCE(SUM(profit_loss), 0)::float8 AS pl,
         COUNT(*) FILTER (WHERE profit_loss > 0)::int AS wins
  FROM t
  WHERE close_time >= date_trunc('day', now())
),
recent AS (
  -- Active streak: hitung deret win/lose terakhir (dari paling baru mundur)
  SELECT ROW_NUMBER() OVER (ORDER BY close_time DESC, id DESC) AS rn,
         profit_loss > 0 AS is_win
  FROM t
),
base AS (
  SELECT is_win FROM recent WHERE rn = 1
),
opp AS (
  SELECT MIN(r.recent_rn) AS first_opp
  FROM (
    SELECT rn AS recent_rn, is_win FROM recent
  ) r
  CROSS JOIN base b
  WHERE r.is_win <> b.is_win
),
streak AS (
  SELECT
    (SELECT CASE WHEN is_win THEN 'win' ELSE 'lose' END FROM base) AS type,
    COALESCE((
      SELECT COUNT(*)::int FROM recent
      WHERE is_win = (SELECT is_win FROM base)
        AND rn < COALESCE((SELECT first_opp FROM opp), 2147483647)
    ), 0) AS cnt
),
daynames AS (
  SELECT ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] AS names
)
SELECT jsonb_build_object(
  'totalTrades',    s.total_trades,
  'winningTrades',  s.winning_trades,
  'losingTrades',   s.losing_trades,
  'winRate',        CASE WHEN s.total_trades > 0
                      THEN (s.winning_trades::float8 / s.total_trades) * 100 ELSE 0 END,
  'totalPL',        s.total_pl,
  'avgProfit',      s.avg_profit,
  'avgLoss',        s.avg_loss,
  -- JS: grossLoss>0 → gp/gl; else gp>0 → Infinity; JSON.stringify(Infinity) = null
  'profitFactor',   CASE
                      WHEN s.gross_loss > 0 THEN s.gross_profit / s.gross_loss
                      WHEN s.gross_profit > 0 THEN NULL
                      ELSE 0 END,
  'maxDrawdown',    dd.max_drawdown,
  'sharpeRatio',    CASE WHEN s.sd > 0 THEN (s.avg_return / s.sd) * sqrt(252) ELSE 0 END,
  'equityCurve',    equity.curve,
  'sessionPerformance', COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'session', x.session, 'trades', x.trades, 'pl', x.pl,
               'winRate', CASE WHEN x.trades > 0 THEN (x.wins::float8 / x.trades) * 100 ELSE 0 END)
             ORDER BY x.first_seen)
    FROM sess x), '[]'::jsonb),
  'monthlyPerformance', COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object('month', m.month, 'pl', m.pl, 'trades', m.trades)
             ORDER BY m.month)
    FROM monthly m), '[]'::jsonb),
  'symbolPerformance', COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'symbol', y.symbol, 'trades', y.trades, 'pl', y.pl, 'wins', y.wins,
               'winRate', CASE WHEN y.trades > 0 THEN (y.wins::float8 / y.trades) * 100 ELSE 0 END)
             ORDER BY y.pl DESC)
    FROM sym y), '[]'::jsonb),
  'dayOfWeekPerformance', COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'day',  (SELECT names[d.dow + 1] FROM daynames),
               'trades', d.trades, 'pl', d.pl,
               'winRate', CASE WHEN d.trades > 0 THEN (d.wins::float8 / d.trades) * 100 ELSE 0 END)
             ORDER BY (SELECT names[d.dow + 1] FROM daynames))
    FROM dow d), '[]'::jsonb),
  'avgTradeDuration', s.avg_duration,
  'avgRRRatio',       s.avg_rr,
  'setupTypePerformance', COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'setup_type', z.setup_type, 'trades', z.trades, 'pl', z.pl, 'wins', z.wins,
               'winRate', CASE WHEN z.trades > 0 THEN (z.wins::float8 / z.trades) * 100 ELSE 0 END)
             ORDER BY z.pl DESC)
    FROM setup z), '[]'::jsonb),
  'today', jsonb_build_object(
    'trades', td.trades,
    'pl',     td.pl,
    'winRate', CASE WHEN td.trades > 0 THEN (td.wins::float8 / td.trades) * 100 ELSE 0 END),
  'activeStreak', jsonb_build_object('type', sk.type, 'count', sk.cnt)
)
FROM stats s, dd, equity, today td, streak sk;
$$;

-- ── Verifikasi ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_analytics_snapshot'
  ) THEN
    RAISE NOTICE '✅ get_analytics_snapshot siap (SECURITY INVOKER, RLS tetap jalan)';
  ELSE
    RAISE NOTICE '❌ function tidak ditemukan — cek error di atas';
  END IF;
END
$$;
