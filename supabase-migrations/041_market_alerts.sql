-- ============================================================
-- 041_market_alerts.sql — Real-time Alert Engine (Sinyal VIP)
-- ============================================================
-- Log setiap sinyal VIP yang ter-broadcast (jalur WebSocket Node
-- maupun cron REST Cloudflare Workers) — lihat
-- src/services/marketListener.ts & /api/cron/vip-signals.
--
-- Jalankan di Supabase SQL Editor (produksi) — pola migrasi 001–040.
-- RLS aktif TANPA policy publik → hanya service-role yang boleh
-- baca/tulis (feed publik /api/vip-signals/latest lewat admin client).
-- ============================================================

create table if not exists public.market_alerts (
  id              uuid primary key default gen_random_uuid(),
  symbol          text not null default 'XAU/USD',
  action          text not null check (action in ('BUY', 'SELL')),
  entry_price     double precision not null,
  sl              double precision not null,
  tp              double precision not null,
  trigger_price   double precision,
  source          text not null default 'ws-listener', -- ws-listener | poll | demo
  broadcast_count integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists market_alerts_created_at_idx
  on public.market_alerts (created_at desc);

alter table public.market_alerts enable row level security;
