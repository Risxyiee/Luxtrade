-- ============================================================
-- SQL 20261101 — notification_log (pusat notifikasi in-app)
-- ============================================================
-- Tujuan: SETIAP notifikasi otomatis yang dikirim server (push HP)
-- ikut TERSIMPAN di sini → tampil di Bell/NotificationCenter dashboard
-- (desktop & user tanpa push tetap kebagian riwayat alert).
--
-- Sumber yang otomatis menulis ke tabel ini (via push-notify.ts):
--   🚨 guard prop firm   📈 sinyal Pine       🎯 price alert
--   💥 big win/loss dll  🌅 reminder harian   📊 rekap mingguan
--
-- Retensi 30 hari — dibersihkan oleh cron daily-reminder.
-- Idempotent — aman dijalankan berulang.

create table if not exists public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    text        not null,
  title      text        not null,
  body       text,
  type       text,       -- 'trade' | 'price-alert' | 'news' | 'general'
  url        text,       -- tujuan saat item diklik (path relatif)
  tag        text,       -- dedupe/identitas sumber (propfirm-*, pine-*, dst)
  read       boolean     not null default false,
  created_at timestamptz not null default now()
);

-- Feed: list terbaru per user
create index if not exists notification_log_user_created_idx
  on public.notification_log (user_id, created_at desc);

-- Badge unread: hitung cepat
create index if not exists notification_log_unread_idx
  on public.notification_log (user_id) where read = false;

-- Hanya service-role (API server) yang menulis/membaca
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;
