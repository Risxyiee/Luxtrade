-- ══════════════════════════════════════════════════════════════════════════════
-- 032 — PERF F1: 4 index komposit untuk query panas (hasil audit performa)
-- ══════════════════════════════════════════════════════════════════════════════
-- Latar belakang (audit F1):
--   1. journal_entries: GET journal selalu filter user_id + order created_at
--      → index (user_id) saja bikin sort penuh tiap request.
--   2. trades(user_id, ticket_number): dedup auto-journal lookup per submission.
--   3. trades(created_at): recent-activity order created_at desc limit 10
--      → tanpa index = top-N sort atas seluruh tabel tiap cache miss.
--   4. testimonials(status, is_featured, created_at): list publik filter+sort.
--
-- Semua CREATE INDEX IF NOT EXISTS → idempotent, aman dijalankan ulang.
-- Tabel kecil-menengah → lock sesaat, aman untuk dijalankan kapan pun.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Journal list + monthly count (journal_entries)
create index if not exists journal_entries_user_id_created_at_idx
  on journal_entries (user_id, created_at);

-- 2. Auto-journal dedup (trades)
create index if not exists trades_user_id_ticket_number_idx
  on trades (user_id, ticket_number);

-- 3. Recent activity top-N (trades)
create index if not exists trades_created_at_idx
  on trades (created_at);

-- 4. Testimonials publik (testimonials)
create index if not exists testimonials_status_featured_created_idx
  on testimonials (status, is_featured, created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- VERIFIKASI — jalankan, kirim hasilnya ke Z (harus muncul 4 index baru)
-- ──────────────────────────────────────────────────────────────────────────────
select tablename, indexname
from pg_indexes
where indexname in (
  'journal_entries_user_id_created_at_idx',
  'trades_user_id_ticket_number_idx',
  'trades_created_at_idx',
  'testimonials_status_featured_created_idx'
)
order by tablename;
-- ══════════════════════════════════════════════════════════════════════════════
