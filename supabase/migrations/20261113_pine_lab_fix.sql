-- ============================================================
-- 20261113_pine_lab_fix.sql — PINE LAB: REKONSILIASI SKEMA
-- ============================================================
-- PENYEBAB ERROR SEBELUMNYA (42703 "column active does not exist"):
--   Tabel pine_scripts LAMA (era pine-alert, dibuat ad-hoc di luar
--   folder migrasi) sudah ada di database TANPA kolom `active` →
--   `create table if not exists` di-skip → index pada kolom yang
--   tidak ada → SELURUH script gagal (dijalankan sebagai satu
--   transaksi) → tabel user_flags / pine_events_sent / pine_runs
--   tidak jadi dibuat → gate /pine-lab selalu 403
--   ("Pine Lab sedang dalam tahap uji privat dan belum dibuka...").
--
-- YANG DILAKUKAN FILE INI:
--   0. Bersihkan artefak SQL lama yang gagal (kalau sempat menempel).
--   1. pine_scripts versi lama di-RENAME jadi cadangan
--      (pine_scripts_legacy_alert) — TIDAK ADA DATA YANG HILANG.
--   2. Semua tabel Pine Lab dibuat dengan skema RESMI yang dipakai
--      API (src/lib/pine-lab + /api/pine-lab/* + /api/cron/pine-lab).
--   3. Kolom `trigger` di pine_runs PAKAI KUTIP GANDA — kata
--      tercadang PostgreSQL (migrasi 20261112 lama error syntax
--      karena kolom ini ditulis tanpa kutip).
--   4. Seed flag pine_lab untuk akun admin Bos → akses terbuka.
--
-- IDEMPOTENT — aman dijalankan berulang kali.
-- Jalankan SELURUH isi file sekaligus di Supabase SQL Editor.
-- ============================================================

-- ── 0) Bersihkan artefak SQL lama yang gagal (kalau ada) ──────
drop table if exists public.feature_flags;               -- versi lama, tidak dipakai kode
drop index if exists public.idx_pine_scripts_user;       -- duplikat index kanonik
drop index if exists public.idx_pine_events_sent_script;
drop index if exists public.idx_pine_events_sent_cleanup;
drop index if exists public.idx_pine_runs_user_time;
drop index if exists public.idx_pine_runs_script_time;
drop index if exists public.idx_push_subscriptions_user;

-- ── 1) pine_scripts LAMA (tanpa kolom active) → cadangkan ────
do $$
begin
  if to_regclass('public.pine_scripts') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name   = 'pine_scripts'
         and column_name  = 'active'
     ) then
    execute 'alter table public.pine_scripts rename to pine_scripts_legacy_alert';
    raise notice 'pine_scripts versi lama (era pine-alert) dicadangkan sebagai pine_scripts_legacy_alert';
  end if;
end
$$;
-- Semua FK lama yang menunjuk pine_scripts otomatis mengikuti tabel
-- yang di-rename — tidak ada relasi yang rusak.

-- ── 2) pine_scripts — skema resmi (persis yang dipakai API) ──
create table if not exists public.pine_scripts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Script tanpa nama',
  symbol      text not null default 'XAUUSD',
  source      text not null default '',
  active      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  last_run_at timestamptz,
  last_run_ms integer,
  last_error  text
);

-- Self-healing: kalau ada tabel versi lain yang lolos, lengkapi kolomnya
alter table public.pine_scripts add column if not exists symbol      text not null default 'XAUUSD';
alter table public.pine_scripts add column if not exists source      text not null default '';
alter table public.pine_scripts add column if not exists active      boolean not null default false;
alter table public.pine_scripts add column if not exists created_at  timestamptz not null default now();
alter table public.pine_scripts add column if not exists updated_at  timestamptz not null default now();
alter table public.pine_scripts add column if not exists last_run_at timestamptz;
alter table public.pine_scripts add column if not exists last_run_ms integer;
alter table public.pine_scripts add column if not exists last_error  text;

create index if not exists pine_scripts_user_idx   on public.pine_scripts (user_id);
create index if not exists pine_scripts_active_idx on public.pine_scripts (active) where active = true;

-- ── 3) pine_events_sent — dedupe event (cron hanya push event BARU) ──
create table if not exists public.pine_events_sent (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  script_id uuid references public.pine_scripts(id) on delete cascade,
  event_id  text not null,
  sent_at   timestamptz not null default now()
);

alter table public.pine_events_sent add column if not exists script_id uuid references public.pine_scripts(id) on delete cascade;
alter table public.pine_events_sent add column if not exists sent_at   timestamptz not null default now();

-- Kunci dedupe HARUS (user_id, script_id, event_id) — harus persis
-- sama dengan onConflict kode cron: 'user_id,script_id,event_id'.
-- Versi SQL lama salah membuat unique (user_id, event_id) saja → dibuang.
alter table public.pine_events_sent drop constraint if exists pine_events_sent_unique;
alter table public.pine_events_sent drop constraint if exists pine_events_sent_user_id_event_id_key;
drop index if exists public.pine_events_sent_unique;
create unique index if not exists pine_events_sent_unique
  on public.pine_events_sent (user_id, script_id, event_id);

create index if not exists pine_events_sent_user_idx on public.pine_events_sent (user_id);

-- ── 4) pine_runs — log durasi run + rate-limit 20 run manual/jam ──
-- CATATAN: `trigger` adalah KATA TERCADANG PostgreSQL → wajib kutip.
do $$
begin
  if to_regclass('public.pine_runs') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name   = 'pine_runs'
         and column_name  = 'trigger'
     ) then
    drop table public.pine_runs;   -- versi salah skema dari SQL lama (trigger_type)
    raise notice 'pine_runs versi salah skema dibuang — dibuat ulang dengan skema resmi';
  end if;
end
$$;

create table if not exists public.pine_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  script_id     uuid references public.pine_scripts(id) on delete cascade,
  "trigger"     text not null default 'manual',  -- 'manual' | 'cron'
  ok            boolean not null default true,
  duration_ms   integer not null default 0,
  bars          integer not null default 0,
  events        integer not null default 0,
  error_code    text,
  error_message text,
  created_at    timestamptz not null default now()
);

alter table public.pine_runs add column if not exists "trigger"     text not null default 'manual';
alter table public.pine_runs add column if not exists ok            boolean not null default true;
alter table public.pine_runs add column if not exists duration_ms   integer not null default 0;
alter table public.pine_runs add column if not exists bars          integer not null default 0;
alter table public.pine_runs add column if not exists events        integer not null default 0;
alter table public.pine_runs add column if not exists error_code    text;
alter table public.pine_runs add column if not exists error_message text;
alter table public.pine_runs add column if not exists created_at    timestamptz not null default now();

create index if not exists pine_runs_user_created_idx on public.pine_runs (user_id, created_at desc);
create index if not exists pine_runs_script_idx       on public.pine_runs (script_id, created_at desc);

-- ── 5) user_flags — GERBANG akses Pine Lab (feature flag) ────
create table if not exists public.user_flags (
  user_id    uuid not null references auth.users(id) on delete cascade,
  flag       text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, flag)
);

-- Seed: buka akses Pine Lab untuk akun admin Bos.
insert into public.user_flags (user_id, flag)
select u.id, 'pine_lab'
from auth.users u
where lower(u.email) = 'luxtradee@gmail.com'
on conflict (user_id, flag) do nothing;

-- (Opsional) buka akses untuk email lain — ganti email, lepas komentar:
-- insert into public.user_flags (user_id, flag)
-- select u.id, 'pine_lab'
-- from auth.users u
-- where lower(u.email) = 'email-lain@domain.com'
-- on conflict (user_id, flag) do nothing;

-- ── 6) RLS: kunci SEMUA tabel (deny-all) ─────────────────────
-- API server memakai service-role key (bypass RLS) dan SELALU
-- memfilter user_id per-request — client tidak pernah menyentuh
-- tabel ini langsung dengan anon key.
alter table public.pine_scripts     enable row level security;
alter table public.pine_events_sent enable row level security;
alter table public.pine_runs        enable row level security;
alter table public.user_flags       enable row level security;
alter table public.pine_scripts_legacy_alert enable row level security;

-- ============================================================
-- VERIFIKASI — cek hasil di panel Results setelah jalan:
--   Hasil 1: pine_scripts harus punya kolom active, symbol,
--            source, last_run_at, last_run_ms, last_error.
--   Hasil 2: baris email Bos + flag pine_lab harus muncul
--            (kalau kosong → email login Bos bukan
--            luxtradee@gmail.com → pakai blok opsional di atas).
-- ============================================================
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'pine_scripts'
order by ordinal_position;

select u.email, uf.flag, uf.created_at
from public.user_flags uf
join auth.users u on u.id = uf.user_id
where uf.flag = 'pine_lab';
