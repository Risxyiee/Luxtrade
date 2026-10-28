-- ============================================================
-- LUXTRADE — PROTECTED CUSTOM PINE SCRIPT (Task 41)
-- Jalankan SEKALI di Supabase → SQL Editor → Run. IDEMPOTENT
-- (aman dijalankan berulang).
--
-- Fungsi:
--   1. protected_scripts — skrip Pine MASTER milik Bos yang
--      TERPROTEKSI. Source code HANYA bisa dibaca server
--      (service role) — tidak ada policy/grant untuk
--      anon/authenticated, jadi mustahil bocor ke browser.
--   2. pine_alert_log — log sinyal Entry/SL/TP per user per bar
--      (dedupe anti-spam Telegram; constraint UNIQUE per bar).
--
-- Kebijakan akses (PENTING):
--   - RLS aktif + TANPA policy + REVOKE dari anon/authenticated
--     → hanya server (SUPABASE_SERVICE_ROLE_KEY) yang bisa baca/tulis.
--   - Client hanya lewat /api/compile-pine (gate is_pro).
-- ============================================================

-- ---------- 1) SKRIP MASTER TERPROTEKSI ----------
create table if not exists public.protected_scripts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  source      text not null,              -- PINE SOURCE (RAHASIA)
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  -- Aturan sinyal declaratif utk skrip tanpa alert():
  -- [{"type":"cross_above","a":"close","b":50,"signal":"ENTRY_LONG"}]
  alert_rules jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- 2) LOG SINYAL (dedupe per bar) ----------
create table if not exists public.pine_alert_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  script_id   uuid not null references public.protected_scripts(id) on delete cascade,
  symbol      text not null,
  signal_type text not null,              -- ENTRY_LONG/ENTRY_SHORT/SL/TP/…
  bar_time    timestamptz not null,       -- open time bar pemicu
  price       numeric not null,
  created_at  timestamptz not null default now()
);

-- ANTI-SPAM: 1 sinyal yang sama per bar per user — sisanya diabaikan server
create unique index if not exists pine_alert_log_unique
  on public.pine_alert_log (user_id, script_id, symbol, signal_type, bar_time);
create index if not exists pine_alert_log_user_idx
  on public.pine_alert_log (user_id, created_at desc);

-- ---------- 3) KUNCI AKSES: hanya service role ----------
-- RLS aktif tanpa policy = anon/authenticated DITOLAK total.
alter table public.protected_scripts enable row level security;
alter table public.pine_alert_log    enable row level security;

-- Hapus sisa policy lama bila pernah dibuat
drop policy if exists "protected_scripts_no_client" on public.protected_scripts;
drop policy if exists "pine_alert_log_no_client"    on public.pine_alert_log;

-- Cabut semua hak client (defense in depth — meski RLS sudah menolak)
revoke all on public.protected_scripts from anon, authenticated;
revoke all on public.pine_alert_log    from anon, authenticated;

-- ============================================================
-- 4) CONTOH SKRIP MASTER (boleh dihapus/diubah Bos)
--    "Luxtradee Sniper EMA" — EMA 21/55 + SL/TP + alert entry.
--    Kosongkan saja jika Bos ingin mengisi skrip sendiri:
--      update public.protected_scripts set source = '<PINE>...' where slug = 'ltx-sniper-ema';
-- ============================================================
insert into public.protected_scripts (slug, name, description, source, is_active, sort_order, alert_rules)
values (
  'ltx-sniper-ema',
  'Luxtradee Sniper EMA',
  'Skrip eksklusif Luxtradee: konfluensi EMA 21/55 + momentum. Entry, SL, dan TP digambar otomatis — alert masuk ke Telegram.',
  E'//@version=6\nindicator("Luxtradee Sniper EMA", overlay=true)\n\nemaFast = ta.ema(close, 21)\nemaSlow = ta.ema(close, 55)\n\nlongCond  = ta.crossover(emaFast, emaSlow)\nshortCond = ta.crossunder(emaFast, emaSlow)\n\natr = ta.atr(14)\nlongSL  = close - atr * 1.5\nlongTP  = close + atr * 3.0\n\nplot(emaFast, title="EMA 21", color=color.orange, linewidth=2)\nplot(emaSlow, title="EMA 55", color=color.teal, linewidth=2)\nplot(longCond ? longSL : na, title="SL Long", color=color.red, linewidth=1, style=plot.style_circles)\nplot(longCond ? longTP : na, title="TP Long", color=color.green, linewidth=1, style=plot.style_circles)\n\nif longCond\n    alert("ENTRY LONG " + syminfo.ticker + " @ " + str.tostring(close) + " | SL " + str.tostring(longSL) + " | TP " + str.tostring(longTP), alert.freq_once_per_bar)\nif shortCond\n    alert("ENTRY SHORT " + syminfo.ticker + " @ " + str.tostring(close), alert.freq_once_per_bar)',
  true,
  0,
  -- Fallback rules declaratif: close menembus EMA cepat (plot_0 = EMA 21)
  '[{"type":"cross_above","a":"close","b":"plot_0","signal":"ENTRY_LONG","message":"Harga menembus atas EMA cepat (momentum bullish)"},{"type":"cross_below","a":"close","b":"plot_0","signal":"ENTRY_SHORT","message":"Harga menembus bawah EMA cepat (momentum bearish)"}]'::jsonb
)
on conflict (slug) do nothing;
