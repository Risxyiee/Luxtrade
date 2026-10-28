-- ============================================================
-- LUXTRADE — QUOTA & PINE SCRIPT TABLES (Task 36, FIX Task 40)
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- FIX "permission denied for table user_quotas":
--   tabel mungkin sudah ada tapi GRANT untuk service_role/authenticated
--   belum terpasang (SQL lama gagal di tengah). Versi ini IDEMPOTENT
--   (aman dijalankan berulang): drop policy dulu, lalu create lagi,
--   plus GRANT eksplisit ke anon/authenticated/service_role.
--
-- Tabel:
--   1. user_quotas   — kuota freemium (alert Telegram & edit Pine Script)
--      Reset TIDAK pakai cron: kolom tanggal reset dibandingkan saat dibaca
--      (lazy reset) oleh src/lib/user-quota.ts → selalu benar tanpa job.
--   2. pine_scripts  — skrip Pine Script® milik user (hasil Save dari
--      editor Vela di Chart Tab).
--   3. (bonus) kolom telegram_chat_id di profiles — deep linking bot.
-- ============================================================

-- ---------- 1) KUOTA FREEMIUM ----------
create table if not exists public.user_quotas (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  -- Alert Telegram (free: 2x/hari; Pro: tanpa batas)
  alerts_today_count     integer not null default 0,
  alerts_reset_date      date,
  -- Edit Pine Script (free: 2x/bulan; Pro: tanpa batas)
  pine_edits_month_count integer not null default 0,
  pine_reset_month       text,   -- format 'YYYY-MM' (WIB)
  updated_at             timestamptz not null default now()
);

-- ---------- 2) PINE SCRIPT MILIK USER ----------
create table if not exists public.pine_scripts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Untitled script',
  source     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pine_scripts_user_idx
  on public.pine_scripts (user_id, updated_at desc);

-- ---------- 3) GRANT — INI YANG MENGHILANGKAN "permission denied" ----------
-- API menulis via service role; badge kuota dibaca client (authenticated).
-- Tanpa GRANT ini, service role pun bisa kena 42501 permission denied.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.user_quotas  to anon, authenticated, service_role;
grant select, insert, update, delete on public.pine_scripts to anon, authenticated, service_role;

-- ---------- 4) RLS + POLICY (drop dulu supaya bisa diulang) ----------
alter table public.user_quotas  enable row level security;
alter table public.pine_scripts enable row level security;

-- user boleh LIHAT kuotanya sendiri (badge sisa kuota di UI).
-- PENULISAN hanya lewat service role (API routes) → tidak ada policy
-- insert/update untuk anon/authenticated, jadi user tak bisa mengakali count.
drop policy if exists "user_quotas_select_own" on public.user_quotas;
create policy "user_quotas_select_own"
  on public.user_quotas for select
  using (auth.uid() = user_id);

-- Pemilik boleh CRUD skripnya sendiri (editor Vela membaca daftar
-- skrip user langsung via anon key + session).
drop policy if exists "pine_scripts_owner_all" on public.pine_scripts;
create policy "pine_scripts_owner_all"
  on public.pine_scripts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 5) BONUS: kolom Telegram (deep linking bot @luxtradeebot) ----------
alter table public.profiles add column if not exists telegram_chat_id text;
