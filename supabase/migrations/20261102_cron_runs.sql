-- ============================================================
-- SQL 20261102 — cron_runs (riwayat & health monitor cron)
-- ============================================================
-- Diisi otomatis oleh /api/cron/health-alert setiap slot cron CF
-- selesai: heartbeat ok:true per route + ok:false untuk yang gagal.
-- Status dibaca via GET /api/cron/health (Bearer CRON_SECRET).
--
-- Idempotent — aman dijalankan berulang.

create table if not exists public.cron_runs (
  id          uuid primary key default gen_random_uuid(),
  cron        text,
  route       text        not null,
  ok          boolean     not null,
  status      int,
  duration_ms int,
  error       text,
  ran_at      timestamptz not null default now()
);

create index if not exists cron_runs_route_time_idx
  on public.cron_runs (route, ran_at desc);

create index if not exists cron_runs_ran_at_idx
  on public.cron_runs (ran_at desc);

-- Hanya service-role yang menulis/membaca (worker & status API);
-- user tidak perlu akses anon.
alter table public.cron_runs enable row level security;
revoke all on public.cron_runs from anon, authenticated;
