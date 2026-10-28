-- ============================================================
-- LUXTRADEE — PINE ALERT SUBSCRIPTIONS (Task 44)
-- Jalankan SEKALI di Supabase → SQL Editor → Run. IDEMPOTENT
-- (aman dijalankan berulang).
--
-- Fungsi:
--   pine_alert_subscriptions — langganan alert otomatis per user
--   per skrip terproteksi per (symbol, timeframe). Diaktifkan
--   LEWAT UI KLIK: ikon 🔔 di chip "Eksklusif" chart → pilih
--   simbol + timeframe → Aktifkan. Tidak perlu SQL/JSON manual.
--
--   Runner cron (/api/cron/pine-alerts — GitHub Actions tiap
--   5 menit) membaca tabel ini → mengeksekusi skrip headless di
--   server → sinyal Entry/SL/TP masuk Telegram user Pro.
--
-- Kebijakan akses (sama dengan protected_scripts):
--   RLS aktif + TANPA policy + REVOKE dari anon/authenticated
--   → hanya server (SUPABASE_SERVICE_ROLE_KEY) yang bisa akses.
-- ============================================================

-- ---------- 1) TABEL LANGGANAN ALERT ----------
create table if not exists public.pine_alert_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  script_id       uuid not null references public.protected_scripts(id) on delete cascade,
  symbol          text not null,                 -- XAUUSD, BTCUSDT, US100, …
  timeframe       text not null default '1h',    -- 5m/15m/30m/1h/2h/4h/1d/1w
  enabled         boolean not null default true, -- toggle UI (matikan tanpa hapus)
  last_trigger_at timestamptz,                   -- info: kapan terakhir ada sinyal
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 1 langganan unik per (user, skrip, symbol, timeframe)
-- → toggle on/off cukup UPDATE baris yang sama (upsert server).
create unique index if not exists pine_alert_sub_unique
  on public.pine_alert_subscriptions (user_id, script_id, symbol, timeframe);
create index if not exists pine_alert_sub_enabled_idx
  on public.pine_alert_subscriptions (enabled);

-- ---------- 2) KUNCI AKSES: hanya service role ----------
alter table public.pine_alert_subscriptions enable row level security;
drop policy if exists "pine_alert_sub_no_client" on public.pine_alert_subscriptions;
revoke all on public.pine_alert_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.pine_alert_subscriptions to service_role;

-- ============================================================
-- 3) VERIFIKASI (opsional)
--    select count(*) from public.pine_alert_subscriptions;
-- ============================================================
