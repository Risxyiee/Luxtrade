-- ============================================================
--  PINE SIGNALS (fitur PRO) — skema database
--  Jalankan MANUAL di Supabase Dashboard -> SQL Editor (aturan proyek).
--  Idempotent: aman dieksekusi berulang.
-- ============================================================

-- 1) Script Pine milik user ---------------------------------------------
create table if not exists pine_scripts (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  name          text not null,
  kind          text not null default 'strategy',      -- 'strategy' | 'indicator'
  source        text not null,
  version       int not null default 1,
  status        text not null default 'ACTIVE',        -- 'ACTIVE' | 'PAUSED' | 'ERROR'
  validation    jsonb,                                 -- {ok, errors, warnings, validatedAt}
  config        jsonb not null default '{}',           -- input runtime (bodyMin, slUsd, ...)
  symbol        text not null default 'XAUUSD',
  timeframe     text not null default 'H1',
  alerts_enabled boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_pine_scripts_user on pine_scripts (user_id, updated_at desc);

-- 2) Riwayat versi script -------------------------------------------------
create table if not exists pine_script_versions (
  id          uuid primary key default gen_random_uuid(),
  script_id   uuid not null references pine_scripts (id) on delete cascade,
  version     int not null,
  source      text not null,
  validation  jsonb,
  created_at  timestamptz not null default now(),
  unique (script_id, version)
);

-- 3) Event sinyal + kunci idempotensi --------------------------------------
-- id = `${script_id}:${candle_time}:${side}:${event}` (+#suffix utk SIGNAL ganda)
-- Insert dengan on_conflict(id) do nothing -> hanya event BARU yang kembali,
-- inilah jaminan anti alert ganda saat restart/retry (Uji C).
create table if not exists pine_events (
  id            text primary key,
  script_id     uuid not null references pine_scripts (id) on delete cascade,
  user_id       text not null,
  event         text not null,                          -- PLACE_LIMIT/REPLACE_LIMIT/CANCEL_PENDING/CLOSE_POSITION/SIGNAL
  candle_time   bigint not null,                        -- ms UTC waktu OPEN candle
  side          text,                                   -- 'BUY' | 'SELL' | null
  payload       jsonb not null,                         -- event standar lengkap
  delivered     boolean not null default false,
  channels      jsonb not null default '[]',            -- hasil per kanal
  delivered_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_pine_events_script_time on pine_events (script_id, candle_time desc);
create index if not exists idx_pine_events_user_time on pine_events (user_id, created_at desc);

-- 4) Kanal alert per user ---------------------------------------------------
create table if not exists pine_alert_channels (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  type       text not null,                              -- 'push' | 'telegram' | 'webhook'
  config     jsonb not null default '{}',                -- {chatId} | {url, secret} | {}
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, type)
);

-- 5) Audit eksekusi runner ---------------------------------------------------
create table if not exists pine_runs (
  id          uuid primary key default gen_random_uuid(),
  script_id   uuid not null references pine_scripts (id) on delete cascade,
  user_id     text not null,
  trigger     text not null default 'manual',            -- 'manual' | 'live' | 'validation'
  status      text not null,                             -- 'ok' | 'error' | 'timeout'
  bars        int,
  duration_ms int,
  new_events  int not null default 0,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_pine_runs_script on pine_runs (script_id, created_at desc);

-- 6) RLS: pemilik data penuh akses, layanan (service role) bebas -------------
alter table pine_scripts         enable row level security;
alter table pine_script_versions enable row level security;
alter table pine_events          enable row level security;
alter table pine_alert_channels  enable row level security;
alter table pine_runs            enable row level security;

drop policy if exists pine_scripts_owner on pine_scripts;
create policy pine_scripts_owner on pine_scripts
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists pine_script_versions_owner on pine_script_versions;
create policy pine_script_versions_owner on pine_script_versions
  for all using (
    exists (select 1 from pine_scripts s where s.id = script_id and s.user_id = auth.uid()::text)
  ) with check (
    exists (select 1 from pine_scripts s where s.id = script_id and s.user_id = auth.uid()::text)
  );

drop policy if exists pine_events_owner on pine_events;
create policy pine_events_owner on pine_events
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists pine_alert_channels_owner on pine_alert_channels;
create policy pine_alert_channels_owner on pine_alert_channels
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists pine_runs_owner on pine_runs;
create policy pine_runs_owner on pine_runs
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
