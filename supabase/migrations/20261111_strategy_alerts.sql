-- ============================================================
-- SQL 20261111 — strategy_alerts (ALERT STRATEGI & INDIKATOR ALA PINE)
-- ============================================================
-- Direktif Bos (2026-11-11): "saya butuh alert yang di pinescript,
-- mau bikin solusi buat orang yg bayar mahal tradingview biar ke
-- websiteku" + "alert strategi dan indikator yang kita pasang".
--
-- Pengganti alert Pine Script TradingView (wajib langganan Essential
-- ±$13/bln untuk 20 alert + webhook): user pasang KONDISI INDIKATOR
-- (RSI, cross EMA, harga×EMA, MACD, breakout momentum) di simbol +
-- timeframe pilihan → cron /api/cron/strategy-alerts (numpang slot
-- 15-menit, jalur cepat) menghitung indikator dari candle
-- TradingView/TwelveData dan push notif ke HP saat kondisi kena.
--
-- Dedupe: kolom last_bar_time = epoch detik bar yang sudah memicu.
-- Satu push per bar per alert — kondisi "RSI > 30" tidak spam tiap
-- run, tapi menyala lagi di bar baru (perilaku alert "Once Per Bar"
-- ala TradingView).
--
-- IDEMPOTENT — aman dijalankan BERULANG. Kalau tabel sudah pernah
-- dibuat versi lama, bagian ALTER di bawah yang menambah kolom baru.
-- ============================================================

create table if not exists public.strategy_alerts (
  id                uuid primary key default gen_random_uuid(),
  user_id           text        not null,
  symbol            text        not null,

  -- Kondisi ala Pine Script:
  --   RSI_ABOVE | RSI_BELOW           → rsi(level) di atas/bawah threshold
  --   EMA_CROSS_UP | EMA_CROSS_DOWN   → ema_fast cross ema_slow
  --   PRICE_X_EMA_ABOVE | PRICE_X_EMA_BELOW → close cross ema_slow
  --   MACD_CROSS_UP | MACD_CROSS_DOWN → macd cross signal
  --   MOM_BRK_UP | MOM_BRK_DN         → breakout candle kuat + ADX/DMI
  --                                     + fractal + sesi (timeframe bebas)
  cond_type         text        not null,
  timeframe         text        not null default '15m',

  -- Parameter RSI / EMA
  rsi_period        int,
  rsi_level         numeric,
  ema_fast          int,
  ema_slow          int,

  -- Parameter breakout momentum (candle konfluensi)
  body_min_pct      numeric,        -- body minimal (% dari range, 0-100)
  adx_len           int,            -- panjang DI (Wilder)
  adx_smooth        int,            -- smoothing ADX (Wilder)
  adx_min           numeric,        -- ADX minimal (kekuatan tren)
  fractal_len       int,            -- panjang fractal pivot (0 = nonaktif)
  use_fractal       boolean  default true,
  sess_start        text,           -- 'HH:MM' WIB, mis. '07:30'
  sess_end          text,           -- 'HH:MM' WIB, mis. '22:00'
  tz_name           text default 'Asia/Jakarta',

  notes             text,
  active            boolean     not null default true,

  -- Dedupe & statistik (ditulis cron service-role)
  last_bar_time     bigint,
  last_triggered_at timestamptz,
  trigger_count     int         not null default 0,

  created_at        timestamptz not null default now()
);

-- Kompatibel tabel versi lama: tambah kolom yang belum ada
alter table public.strategy_alerts add column if not exists body_min_pct numeric;
alter table public.strategy_alerts add column if not exists adx_len int;
alter table public.strategy_alerts add column if not exists adx_smooth int;
alter table public.strategy_alerts add column if not exists adx_min numeric;
alter table public.strategy_alerts add column if not exists fractal_len int;
alter table public.strategy_alerts add column if not exists use_fractal boolean default true;
alter table public.strategy_alerts add column if not exists sess_start text;
alter table public.strategy_alerts add column if not exists sess_end text;
alter table public.strategy_alerts add column if not exists tz_name text default 'Asia/Jakarta';

-- Cron membaca alert aktif per simbol+timeframe (grouping hemat fetch)
create index if not exists strategy_alerts_active_idx
  on public.strategy_alerts (active, symbol, timeframe);

create index if not exists strategy_alerts_user_idx
  on public.strategy_alerts (user_id);

-- RLS: user hanya boleh lihat/ubah miliknya (API pakai session Supabase);
-- cron memakai service-role yang lolos RLS.
alter table public.strategy_alerts enable row level security;

drop policy if exists strategy_alerts_select_own on public.strategy_alerts;
create policy strategy_alerts_select_own on public.strategy_alerts
  for select to authenticated
  using (auth.uid()::text = user_id);

drop policy if exists strategy_alerts_insert_own on public.strategy_alerts;
create policy strategy_alerts_insert_own on public.strategy_alerts
  for insert to authenticated
  with check (auth.uid()::text = user_id);

drop policy if exists strategy_alerts_update_own on public.strategy_alerts;
create policy strategy_alerts_update_own on public.strategy_alerts
  for update to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists strategy_alerts_delete_own on public.strategy_alerts;
create policy strategy_alerts_delete_own on public.strategy_alerts
  for delete to authenticated
  using (auth.uid()::text = user_id);
