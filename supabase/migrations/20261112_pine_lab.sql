-- ============================================================
-- 20261112_pine_lab.sql — PINE LAB (Lux Engine) — JALANKAN MANUAL
-- di Supabase SQL Editor (sistem migrasi Luxtradee: file SQL
-- dieksekusi manual oleh Bos, sama seperti migration lain).
-- ============================================================
-- !!! SUPERSEDED — JANGAN JALANKAN FILE INI !!!
-- Digantikan oleh: supabase/migrations/20261113_pine_lab_fix.sql
-- Alasan: (1) tabel pine_scripts lama era pine-alert di produksi
--     tidak punya kolom `active` → index (active) gagal 42703;
--     (2) kolom `trigger` = kata tercadang PostgreSQL → wajib
--     kutip ganda, versi lama di file ini error syntax.
-- File 20261113 mengerjakan semuanya secara idempotent + aman
-- untuk database dalam kondisi apa pun.
-- ============================================================
-- Fitur: /pine-lab — halaman eksperimen script "Lux Script"
-- (subset Pine Script) untuk user ber-flag `pine_lab`.
-- Semua tabel RLS-deny (hanya service role yang membaca/menulis —
-- API server memfilter user_id per-request; client TIDAK PERNAH
-- menyentuh tabel ini dengan anon key).
-- ============================================================

-- ── 1) Script milik user ─────────────────────────────────────
create table if not exists public.pine_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Script tanpa nama',
  symbol text not null default 'XAUUSD',
  source text not null default '',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_run_ms integer,
  last_error text
);

create index if not exists pine_scripts_user_idx on public.pine_scripts (user_id);
create index if not exists pine_scripts_active_idx on public.pine_scripts (active) where active = true;

-- ── 2) Dedupe event terkirim (cron hanya push event BARU) ────
create table if not exists public.pine_events_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  script_id uuid references public.pine_scripts(id) on delete cascade,
  event_id text not null,
  sent_at timestamptz not null default now()
);

-- event_id unik per user+script → dedupe DB-level
create unique index if not exists pine_events_sent_unique
  on public.pine_events_sent (user_id, script_id, event_id);
create index if not exists pine_events_sent_user_idx on public.pine_events_sent (user_id);

-- ── 3) Log run (durasi per script + kuota run manual/jam) ────
create table if not exists public.pine_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  script_id uuid references public.pine_scripts(id) on delete cascade,
  "trigger" text not null default 'manual',   -- 'manual' | 'cron' (kata tercadang → wajib kutip)
  ok boolean not null default true,
  duration_ms integer not null default 0,
  bars integer not null default 0,
  events integer not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists pine_runs_user_created_idx on public.pine_runs (user_id, created_at desc);
create index if not exists pine_runs_script_idx on public.pine_runs (script_id, created_at desc);

-- ── 4) Feature flag per user (gate halaman + API) ────────────
create table if not exists public.user_flags (
  user_id uuid not null references auth.users(id) on delete cascade,
  flag text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, flag)
);

-- Seed: aktifkan pine_lab untuk akun admin Bos (luxtradee@gmail.com).
-- Jalankan hanya jika akun sudah ada; kalau belum, ulangi setelah signup.
insert into public.user_flags (user_id, flag)
select u.id, 'pine_lab'
from auth.users u
where u.email = 'luxtradee@gmail.com'
on conflict (user_id, flag) do nothing;

-- ── 5) RLS: kunci semua tabel (service role saja) ────────────
alter table public.pine_scripts    enable row level security;
alter table public.pine_events_sent enable row level security;
alter table public.pine_runs        enable row level security;
alter table public.user_flags       enable row level security;

-- Tanpa policy = deny-all untuk anon/authenticated (service role bypass).
-- Keamanan baca/tulis LEWAT API SERVER yang selalu filter user_id.
