-- ============================================================
-- SQL 20261020 — watchlist_price_alerts (dedupe price alert)
-- ============================================================
-- Dipakai /api/cron/price-alerts: 1 push per (user, item, target).
-- Alert otomatis re-arm saat user MENGUBAH target_price (karena
-- target masuk kunci unik → target baru = baris baru = boleh alert).
--
-- Idempotent — aman dijalankan berulang.

create table if not exists public.watchlist_price_alerts (
  id              uuid primary key default gen_random_uuid(),
  user_id         text        not null,
  watchlist_id    uuid        not null,
  symbol          text        not null,
  target_price    numeric     not null,
  triggered_price numeric,
  alerted_at      timestamptz not null default now()
);

-- Kunci unik dedupe: satu alert per user+item+target
create unique index if not exists watchlist_price_alerts_uniq
  on public.watchlist_price_alerts (user_id, watchlist_id, target_price);

-- Hanya service-role yang menulis (cron); user tidak perlu akses anon
alter table public.watchlist_price_alerts enable row level security;
revoke all on public.watchlist_price_alerts from anon, authenticated;
